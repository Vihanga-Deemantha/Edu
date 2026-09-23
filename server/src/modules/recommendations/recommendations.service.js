import Listing from "../../models/Listing.js";
import TeacherProfile from "../../models/TeacherProfile.js";
import StudentProfile from "../../models/StudentProfile.js";
import RecommendationCache from "../../models/RecommendationCache.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf } from "../../utils/familyAccess.js";

/**
 * Phase 8 — content-based recommendations. No trained model: a weighted
 * scoring function over structured attributes (subject/grade/medium match,
 * location proximity, price-band fit, verification tier, avgRating), run
 * fresh on every request against a bounded candidate pool. This is the
 * "works from day one, zero cold-start" recommender.
 *
 * Phase 12 blends this with a learned collaborative-filtering score from
 * ml-jobs/'s offline ALS job (see blendWithCfScore below) — it upgrades
 * this module rather than replacing it: a candidate with no CF score (the
 * common case for a new listing or a user the model hasn't seen) still
 * scores purely on content match, and a user with no RecommendationCache
 * document at all (never run yet, or genuinely no interaction history) gets
 * exactly Phase 8's original behavior, unchanged. Cold start can't break.
 */

const CANDIDATE_POOL_SIZE = 200; // cheap enough to score in memory per request at this scale; revisit (cache/precompute) only once it measurably isn't
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// A cache older than this is treated as if it doesn't exist — matches the
// "nightly retrain" cadence with slack for a missed run, rather than
// serving an indefinitely-stale learned score if the cron job ever stops.
const CF_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// How much the learned score counts, once one exists for a given candidate
// — the rest stays Phase 8's content score. Deliberately under 0.5: CF is
// the newer, less-inspectable signal here, and a candidate having no CF
// score at all (very common early on) already falls back to 100% content
// score via blendWithCfScore's null check below.
const CF_BLEND_WEIGHT = 0.4;

const norm = (value) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const matchesAny = (value, set) => set.length > 0 && set.includes(norm(value));

// ─── scoring primitives ──────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;
const MAX_RELEVANT_DISTANCE_KM = 50; // beyond this, proximity stops differentiating results

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

/**
 * 1 at the same point, falling off linearly to 0 at MAX_RELEVANT_DISTANCE_KM.
 * Neutral (0.5, not 0) when either side has no location on file — Phase 2
 * made location optional at profile-creation time, so "unknown" is common
 * and shouldn't score as "worst possible".
 */
const locationScore = (pointA, pointB) => {
  if (!pointA?.coordinates || !pointB?.coordinates) return 0.5;
  const km = haversineKm(pointA.coordinates, pointB.coordinates);
  return Math.max(0, 1 - km / MAX_RELEVANT_DISTANCE_KM);
};

/**
 * 1 when askingPrice fits within budget, falling off linearly as it exceeds
 * budget (0 once it's double budget or more). Neutral (0.5) whenever either
 * side is unknown or the units differ (an hourly rate isn't comparable to a
 * monthly one without a conversion this module doesn't attempt).
 */
const priceFitScore = (askingPrice, askingUnit, budget, budgetUnit) => {
  if (askingPrice == null || budget == null || !budgetUnit || askingUnit !== budgetUnit || budget <= 0) {
    return 0.5;
  }
  if (askingPrice <= budget) return 1;
  return Math.max(0, 1 - (askingPrice - budget) / budget);
};

const VERIFICATION_SCORES = { fully_verified: 1, id_verified: 0.5, none: 0 };
const verificationScore = (status) => VERIFICATION_SCORES[status] ?? 0;

// avgRating is stored 0-5; normalized to 0-1 here regardless of the fact
// that TEACHER_MATCH_WEIGHTS below weights it at 0 until Phase 11 supplies
// real reviews — so turning it on later is a one-line weight change, not a
// new code path grafted onto this module.
const ratingScore = (avgRating) => Math.max(0, Math.min(1, (avgRating || 0) / 5));

// ─── weights (each side sums to 100, so a score reads like a percentage) ────

const TEACHER_MATCH_WEIGHTS = {
  subject: 30,
  grade: 20,
  medium: 10,
  location: 20,
  price: 15,
  verification: 5,
  rating: 0,
};

const STUDENT_MATCH_WEIGHTS = {
  subject: 30,
  grade: 20,
  medium: 10,
  location: 20,
  price: 20,
};

const weightedSum = (factors, weights) =>
  Object.entries(weights).reduce((total, [key, weight]) => total + factors[key] * weight, 0);

const scoreTeacherListing = (listing, criteria, profile) => {
  const factors = {
    subject: matchesAny(listing.subject, criteria.subjects) ? 1 : 0,
    grade: matchesAny(listing.grade, criteria.grades) ? 1 : 0,
    medium: matchesAny(listing.medium, criteria.medium) ? 1 : 0,
    location: locationScore(criteria.location, listing.location),
    price: priceFitScore(
      listing.price?.amount ?? null,
      listing.price?.unit ?? null,
      criteria.priceAmount,
      criteria.priceUnit
    ),
    verification: verificationScore(profile?.verificationStatus),
    rating: ratingScore(profile?.avgRating),
  };
  return { score: weightedSum(factors, TEACHER_MATCH_WEIGHTS), factors };
};

const scoreStudentListing = (listing, criteria) => {
  const factors = {
    subject: matchesAny(listing.subject, criteria.subjects) ? 1 : 0,
    grade: matchesAny(listing.grade, criteria.grades) ? 1 : 0,
    medium: matchesAny(listing.medium, criteria.medium) ? 1 : 0,
    location: locationScore(criteria.location, listing.location),
    // Asking price is what this teacher typically charges (their own
    // active ad, if any); budget is the lead's stated budget on their
    // wanted ad — the reverse pairing from scoreTeacherListing above.
    price: priceFitScore(
      criteria.priceAmount,
      criteria.priceUnit,
      listing.price?.amount ?? null,
      listing.price?.unit ?? null
    ),
  };
  return { score: weightedSum(factors, STUDENT_MATCH_WEIGHTS), factors };
};

// ─── Phase 16: "why this match" explainer ───────────────────────────────────

// Template-generated, not an LLM call — per the roadmap, that's the right
// altitude for "why did this rank highly" (a direct readout of the scoring
// factors that already exist), reserving an actual generative call for
// genuinely open-ended explanation text if that's ever wanted later.
const FACTOR_LABELS = {
  subject: "the right subject",
  grade: "the right grade",
  medium: "the right teaching medium",
  location: "nearby",
  price: "within budget",
  verification: "verified",
  rating: "highly rated",
};

const joinWithAnd = (items) => {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
};

/**
 * Picks the top few factors that actually contributed to this candidate's
 * score (weight > 0 and meaningfully present, not just technically
 * nonzero) and phrases them — "Recommended because it's the right subject,
 * the right grade, and nearby." Returns null when nothing scored highly
 * enough to explain (an unranked-feeling result shouldn't get a
 * manufactured reason).
 */
// Deliberately well above the neutral fallback (0.5) that locationScore/
// priceFitScore both return when there's simply no location/budget data to
// compare — factors[key] >= 0.5 would otherwise cite "nearby" and "within
// budget" for a candidate scored against criteria that has neither, since
// "unknown" and "moderately matches" share the same 0.5 value. 0.75 clears
// that ambiguity while still admitting a genuinely strong partial match
// (e.g. 12.5km against the 50km max-relevant-distance scores exactly 0.75).
const EXPLAIN_THRESHOLD = 0.75;

const explainMatch = (factors, weights) => {
  const reasons = Object.entries(weights)
    .filter(([key, weight]) => weight > 0 && factors[key] >= EXPLAIN_THRESHOLD)
    .sort(([keyA, weightA], [keyB, weightB]) => weightB * factors[keyB] - weightA * factors[keyA])
    .slice(0, 3)
    .map(([key]) => FACTOR_LABELS[key]);

  return reasons.length > 0 ? `Recommended because it's ${joinWithAnd(reasons)}.` : null;
};

// ─── Phase 12: collaborative-filtering blend ────────────────────────────────

/**
 * Fresh CF scores for a user, as a Map<targetUserId, score> — empty (not an
 * error) when there's no cache document yet or it's gone stale, so callers
 * never need to branch on "does Phase 12 have anything to say here."
 */
const getFreshCfScores = async (userId) => {
  const cache = await RecommendationCache.findOne({ userId });
  if (!cache || Date.now() - cache.computedAt.getTime() > CF_CACHE_MAX_AGE_MS) {
    return new Map();
  }
  return new Map(cache.recommendations.map((r) => [String(r.targetUserId), r.score]));
};

const blendWithCfScore = (contentScore, cfScore) =>
  cfScore == null ? contentScore : contentScore * (1 - CF_BLEND_WEIGHT) + cfScore * CF_BLEND_WEIGHT;

// ─── candidate pool + criteria builders ─────────────────────────────────────

const fetchCandidateListings = (type) =>
  Listing.find({ type, status: "active" }).sort({ createdAt: -1 }).limit(CANDIDATE_POOL_SIZE);

const resolveLimit = (rawLimit) => {
  const parsed = parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, parsed);
};

const topN = (scored, rawLimit) =>
  scored
    .sort((a, b) => b.score - a.score)
    .slice(0, resolveLimit(rawLimit))
    .map(({ listing, score, reason }) => ({ listing, score: Math.round(score * 10) / 10, reason }));

/**
 * A student's match criteria draws from two places that can each be present,
 * absent, or both: their StudentProfile (subjects interested / grade /
 * medium / location) and their own active student_ad wanted-listing, which
 * additionally carries a price — the "implied budget" the roadmap spec asks
 * for, which StudentProfile has no field for. Neither is required to exist —
 * a brand-new account with neither just gets criteria with nothing to match
 * on, which degrades to a verification/recency-ranked list rather than an
 * error; that's a more useful response than a dead end for a new user.
 */
const buildStudentCriteria = async (targetUserId) => {
  const [profile, wantedAd] = await Promise.all([
    StudentProfile.findOne({ userId: targetUserId }),
    Listing.findOne({ ownerId: targetUserId, type: "student_ad", status: "active" }).sort({ createdAt: -1 }),
  ]);

  const subjects = new Set((profile?.subjectsInterested || []).map(norm));
  const grades = new Set(profile?.gradeOrLevel ? [norm(profile.gradeOrLevel)] : []);
  const medium = new Set((profile?.medium || []).map(norm));
  if (wantedAd) {
    subjects.add(norm(wantedAd.subject));
    grades.add(norm(wantedAd.grade));
    medium.add(norm(wantedAd.medium));
  }

  return {
    subjects: [...subjects],
    grades: [...grades],
    medium: [...medium],
    location: wantedAd?.location || profile?.location || null,
    priceAmount: wantedAd?.price?.amount ?? null,
    priceUnit: wantedAd?.price?.unit ?? null,
  };
};

/**
 * Mirrors resolveOwnerId's role handling in listings.service.js: a student
 * always gets their own recommendations (any client-supplied targetUserId is
 * ignored, not just rejected — there's no ambiguity to reject), a parent
 * must name a linked child explicitly.
 */
const resolveStudentTarget = async (requesterId, requesterRole, targetUserId) => {
  if (requesterRole === "student") return requesterId;

  if (!targetUserId) {
    throw new ApiError(
      400,
      "targetUserId (the child to get recommendations for) is required for a parent.",
      "TARGET_USER_REQUIRED"
    );
  }
  if (!(await isRequesterParentOf(requesterId, targetUserId))) {
    throw new ApiError(
      403,
      "You can only request recommendations for yourself or a linked child account.",
      "FORBIDDEN"
    );
  }
  return targetUserId;
};

/**
 * A teacher's match criteria is their TeacherProfile plus (for price-fit
 * only) their own active teacher_ad — the same "profile or own listing"
 * blend as buildStudentCriteria above. No profile yet just means nothing to
 * match on, same graceful-degradation reasoning as above.
 */
const buildTeacherCriteria = async (teacherUserId) => {
  const [profile, ownListing] = await Promise.all([
    TeacherProfile.findOne({ userId: teacherUserId }),
    Listing.findOne({ ownerId: teacherUserId, type: "teacher_ad", status: "active" }).sort({ createdAt: -1 }),
  ]);

  return {
    subjects: (profile?.subjects || []).map(norm),
    grades: (profile?.grades || []).map(norm),
    medium: (profile?.medium || []).map(norm),
    location: profile?.location || null,
    priceAmount: ownListing?.price?.amount ?? null,
    priceUnit: ownListing?.price?.unit ?? null,
  };
};

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * GET /api/recommendations/teachers — ranked teacher_ad listings for a
 * student, or (via targetUserId) a parent's linked child.
 */
export const recommendTeachersForStudent = async ({ requesterId, requesterRole, targetUserId, limit }) => {
  const resolvedTargetId = await resolveStudentTarget(requesterId, requesterRole, targetUserId);
  const criteria = await buildStudentCriteria(resolvedTargetId);

  const candidates = await fetchCandidateListings("teacher_ad");
  if (candidates.length === 0) return [];

  // Batch-fetch every candidate's TeacherProfile in one query (verification
  // tier + avgRating both live there, not on Listing) instead of N+1 queries
  // — CANDIDATE_POOL_SIZE can be up to 200 per request.
  const ownerIds = [...new Set(candidates.map((listing) => String(listing.ownerId)))];
  const [profiles, cfScores] = await Promise.all([
    TeacherProfile.find({ userId: { $in: ownerIds } }),
    getFreshCfScores(resolvedTargetId),
  ]);
  const profileByOwnerId = new Map(profiles.map((profile) => [String(profile.userId), profile]));

  const scored = candidates.map((listing) => {
    const profile = profileByOwnerId.get(String(listing.ownerId));
    const { score: contentScore, factors } = scoreTeacherListing(listing, criteria, profile);
    const score = blendWithCfScore(contentScore, cfScores.get(String(listing.ownerId)));
    return { listing, score, reason: explainMatch(factors, TEACHER_MATCH_WEIGHTS) };
  });

  return topN(scored, limit);
};

/**
 * GET /api/recommendations/students — ranked student_ad "leads" for the
 * calling teacher, symmetric to recommendTeachersForStudent above.
 */
export const recommendStudentsForTeacher = async ({ requesterId, limit }) => {
  const criteria = await buildTeacherCriteria(requesterId);

  const candidates = await fetchCandidateListings("student_ad");
  if (candidates.length === 0) return [];

  const cfScores = await getFreshCfScores(requesterId);

  const scored = candidates.map((listing) => {
    const { score: contentScore, factors } = scoreStudentListing(listing, criteria);
    const score = blendWithCfScore(contentScore, cfScores.get(String(listing.ownerId)));
    return { listing, score, reason: explainMatch(factors, STUDENT_MATCH_WEIGHTS) };
  });

  return topN(scored, limit);
};
