import mongoose from "mongoose";
import Listing from "../../models/Listing.js";
import TeacherProfile from "../../models/TeacherProfile.js";
import StudentProfile from "../../models/StudentProfile.js";
import RankingConfig from "../../models/RankingConfig.js";
import InterestRequest from "../../models/InterestRequest.js";
import Event from "../../models/Event.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf, resolveOwnedUserIds } from "../../utils/familyAccess.js";
import { embedPassage } from "../../services/embedding.service.js";

/**
 * The single predicate both visibility checks below are built from: is this
 * listing TYPE the kind of thing the general public (not owner, not
 * parent-of-owner, not admin) can see, given the requester's role? A
 * `teacher_ad` always is; a `student_ad` only to an authenticated teacher.
 * `publicVisibilityQueryFilter` (a Mongo query, for list endpoints) and
 * `getListingById` (an imperative single-document check) used to each
 * re-derive this rule independently — provably equivalent today, but
 * nothing enforced that staying true, so a future change to one could
 * silently desync from the other. Both now read from this one function.
 */
const isTypeVisibleToRole = (type, role) => {
  if (type === "teacher_ad") return true;
  return role === "teacher";
};

/**
 * Query-level visibility filter for list endpoints (Phase 6B's /browse uses
 * this) — the general-public view: active listings, and a `student_ad` only
 * if the requester is an authenticated teacher.
 */
export const publicVisibilityQueryFilter = (requester) => {
  const base = { status: "active" };
  if (isTypeVisibleToRole("student_ad", requester?.role)) return base;
  return { ...base, type: "teacher_ad" };
};

const canManage = async (requesterId, requesterRole, listing) => {
  if (String(listing.ownerId) === String(requesterId)) return true;
  if (requesterRole === "parent") return isRequesterParentOf(requesterId, listing.ownerId);
  return false;
};

/**
 * Figures out who a listing actually belongs to, and checks the caller is
 * allowed to post on that owner's behalf. A teacher_ad's owner is always the
 * calling teacher. A student_ad's owner is the calling student, or — for a
 * parent — a linked child specified via targetUserId (mirrors the
 * StudentProfile pattern from Phase 2: a parent acts FOR a child by verified
 * ID, never via the child authenticating).
 */
const resolveOwnerId = async ({ type, requesterId, requesterRole, targetUserId }) => {
  if (type === "teacher_ad") {
    if (requesterRole !== "teacher") {
      throw new ApiError(403, "Only a teacher can post a teacher ad.", "ROLE_MISMATCH");
    }
    return requesterId;
  }

  // student_ad
  if (requesterRole === "student") {
    return requesterId;
  }
  if (requesterRole === "parent") {
    if (!targetUserId) {
      throw new ApiError(
        400,
        "targetUserId (the child this ad is for) is required when a parent posts a student ad.",
        "TARGET_USER_REQUIRED"
      );
    }
    if (!(await isRequesterParentOf(requesterId, targetUserId))) {
      throw new ApiError(
        403,
        "You can only post a student ad for yourself or a linked child account.",
        "FORBIDDEN"
      );
    }
    return targetUserId;
  }
  throw new ApiError(403, "Only a student or parent can post a student ad.", "ROLE_MISMATCH");
};

/**
 * Copies the owner's profile location at creation time — deliberately not a
 * live read on every request, so a teacher moving house later doesn't
 * retroactively relocate an already-posted ad.
 *
 * Checks `!== undefined`, not truthy — `locationBodyValidator` explicitly
 * accepts `location: null` as meaningful input ("no location, on purpose",
 * e.g. a fully-online ad), distinct from the field being omitted entirely.
 * A truthy check treated both the same and silently overwrote an explicit
 * null with the owner's profile location, against the caller's stated intent.
 */
const denormalizeLocation = async (type, ownerId, providedLocation) => {
  if (providedLocation !== undefined) return providedLocation;
  const ProfileModel = type === "teacher_ad" ? TeacherProfile : StudentProfile;
  const profile = await ProfileModel.findOne({ userId: ownerId });
  return profile?.location || undefined;
};

// No default applied at the schema level (see Listing.js) — only stamp a
// currency once we know a price object is actually being stored.
const normalizePrice = (price) => {
  if (!price) return undefined;
  return { ...price, currency: price.currency || "LKR" };
};

/**
 * Phase 16 — the text a listing's embedding is generated from. For a
 * teacher_ad, folds in the owning teacher's bio too: this is how "embed
 * teacher bios and listing descriptions" (the roadmap's own framing) is
 * satisfied without a second, currently-unused embedding field and search
 * path on TeacherProfile — the bio's content enriches the one thing that
 * actually gets searched. Exported so scripts/backfillListingEmbeddings.js
 * builds embeddings from exactly this same text, not a second copy of the
 * same logic that could quietly drift from it.
 */
export const embeddingSourceText = async (listing) => {
  const parts = [listing.subject, listing.grade, listing.description];
  // Phase 19B — fold in whichever translations exist. The embedding model
  // is multilingual (verified live during Phase 16: a Sinhala sentence
  // already embeds close to its English translation), so this isn't what
  // makes cross-language matching *possible* — that already works from the
  // base description alone. It's what makes it *precise*: literal
  // same-language text against a same-language query embeds more sharply
  // than relying purely on the model's cross-lingual transfer, so a
  // Sinhala search benefits from real Sinhala text being in here when a
  // teacher provided it, on top of the cross-lingual fallback still
  // covering listings that only ever got the one base description.
  if (listing.description_si) parts.push(listing.description_si);
  if (listing.description_ta) parts.push(listing.description_ta);
  if (listing.type === "teacher_ad") {
    const profile = await TeacherProfile.findOne({ userId: listing.ownerId }).select("bio bio_si bio_ta");
    if (profile?.bio) parts.push(profile.bio);
    if (profile?.bio_si) parts.push(profile.bio_si);
    if (profile?.bio_ta) parts.push(profile.bio_ta);
  }
  return parts.join(". ");
};

/**
 * Best-effort, not fatal — swallowed and logged, matching Event/
 * Notification's tolerance for a non-core side effect. A listing that
 * fails to get an embedding still works everywhere else (regular browse,
 * sort=rating, sort=recommended); it just won't surface in semantic search
 * until this succeeds on a later update. Awaited (not fire-and-forget)
 * regardless — the model is warmed at server startup, so in practice this
 * adds negligible latency, and awaiting keeps "listing creation finished"
 * a simple true statement rather than a background promise nobody tracks.
 */
const generateAndStoreEmbedding = async (listing) => {
  try {
    listing.embedding = await embedPassage(await embeddingSourceText(listing));
    await listing.save();
  } catch (err) {
    console.error("Embedding generation failed (non-fatal):", err.message);
  }
};

export const createListing = async ({ requesterId, requesterRole, targetUserId, location, price, ...fields }) => {
  const ownerId = await resolveOwnerId({ type: fields.type, requesterId, requesterRole, targetUserId });
  const resolvedLocation = await denormalizeLocation(fields.type, ownerId, location);

  const listing = await Listing.create({
    ...fields,
    ownerId,
    location: resolvedLocation,
    price: normalizePrice(price),
  });

  await generateAndStoreEmbedding(listing);
  return listing;
};

/**
 * Read a single listing. Owner, a parent managing that owner (a linked
 * child), and admin see it regardless of status/type. Everyone else only
 * sees ACTIVE listings, and a student_ad is further restricted to
 * authenticated teachers — a non-teacher gets 404, never 403, so the ad's
 * existence isn't confirmed to someone who isn't allowed to see it at all.
 */
export const getListingById = async (listingId, requester) => {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }

  const isOwner = Boolean(requester) && String(listing.ownerId) === String(requester.id);
  const isAdmin = requester?.role === "admin";
  const isParentOfOwner =
    !isOwner && !isAdmin && requester?.role === "parent"
      ? await isRequesterParentOf(requester.id, listing.ownerId)
      : false;

  if (isOwner || isAdmin || isParentOfOwner) {
    return listing;
  }

  if (listing.status !== "active") {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }

  if (!isTypeVisibleToRole(listing.type, requester?.role)) {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }

  return listing;
};

/**
 * A parent's "my listings" includes any linked child's — otherwise a parent
 * would have no way to see or manage an ad they're fully allowed to create
 * and edit in the first place.
 */
export const getMyListings = async (requesterId, requesterRole) => {
  const ownerIds = await resolveOwnedUserIds(requesterId, requesterRole);
  return Listing.find({ ownerId: { $in: ownerIds } }).sort({ createdAt: -1 });
};

const VIEW_STATS_WINDOW_DAYS = 30;

/**
 * getMyListings plus per-listing activity for the owner's management view:
 * interest requests received (total and still-pending) and listing views over
 * the last 30 days, from Phase 7's Event log. Two grouped aggregations for
 * the whole set, not one query per listing.
 */
export const getMyListingsWithStats = async (requesterId, requesterRole) => {
  const listings = await getMyListings(requesterId, requesterRole);
  if (listings.length === 0) return [];

  const ids = listings.map((l) => l._id);
  const since = new Date(Date.now() - VIEW_STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [interestCounts, viewCounts] = await Promise.all([
    InterestRequest.aggregate([
      { $match: { listingId: { $in: ids } } },
      {
        $group: {
          _id: "$listingId",
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
        },
      },
    ]),
    Event.aggregate([
      { $match: { action: "view_listing", targetId: { $in: ids }, createdAt: { $gte: since } } },
      { $group: { _id: "$targetId", views: { $sum: 1 } } },
    ]),
  ]);

  const interestsById = new Map(interestCounts.map((c) => [String(c._id), c]));
  const viewsById = new Map(viewCounts.map((c) => [String(c._id), c.views]));

  return listings.map((listing) => {
    const interests = interestsById.get(String(listing._id));
    return {
      ...listing.toObject(),
      stats: {
        interestCount: interests?.total || 0,
        pendingInterestCount: interests?.pending || 0,
        views30d: viewsById.get(String(listing._id)) || 0,
      },
    };
  });
};

export const updateListing = async ({ listingId, requesterId, requesterRole, updates }) => {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }
  if (!(await canManage(requesterId, requesterRole, listing))) {
    throw new ApiError(403, "You do not have permission to modify this listing.", "FORBIDDEN");
  }

  const { price, ...rest } = updates;
  Object.assign(listing, rest);
  if (price !== undefined) {
    listing.price = normalizePrice(price);
  }

  // .save() (not findOneAndUpdate) validates against the document's full
  // current state, touched fields or not — no upsert ambiguity to create,
  // since this document is already loaded and known to exist.
  await listing.save();

  // Only regenerated when the text it's derived from actually changed —
  // an update that only touches price/schedule/status has nothing new for
  // semantic search to learn, so there's no reason to pay for a fresh
  // embedding call.
  if (["subject", "grade", "description", "description_si", "description_ta"].some((field) => field in rest)) {
    await generateAndStoreEmbedding(listing);
  }

  return listing;
};

export const closeListing = async (listingId, requesterId, requesterRole) => {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }
  if (!(await canManage(requesterId, requesterRole, listing))) {
    throw new ApiError(403, "You do not have permission to modify this listing.", "FORBIDDEN");
  }
  listing.status = "closed";
  await listing.save();
  return listing;
};

// ─── BROWSE / SEARCH (Phase 6B) ───────────────────────────────────────────────

// subject/grade are free text (no controlled taxonomy yet), matched
// case-insensitively but as a whole-value match, not substring — escaped
// since they're interpolated into a $regex and are otherwise attacker-
// controlled input (unescaped, a query param could inject regex
// metacharacters).
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const caseInsensitiveExact = (value) => new RegExp(`^${escapeRegex(value)}$`, "i");

const NON_GEO_SORTS = {
  price: { "price.amount": 1 },
  newest: { createdAt: -1 },
  rating: { avgRating: -1, createdAt: -1 },
};

const GEO_SORTS = {
  price: { "price.amount": 1 },
  distance: { distanceMeters: 1 },
  newest: { createdAt: -1 },
  rating: { avgRating: -1, distanceMeters: 1 },
};

/**
 * $lookup-joins TeacherProfile.avgRating/reviewCount/verificationStatus onto
 * each listing by ownerId — Phase 11B denormalizes avgRating onto
 * TeacherProfile specifically so this can read a cached value instead of
 * aggregating Review on every search request. A student_ad (no
 * TeacherProfile at all) or a teacher who hasn't built a profile yet both
 * fall back to 0/"none" rather than being excluded — they still show up in
 * results, just sorted last. Only spliced into the pipeline when
 * sort=rating or sort=recommended is actually requested (both need it);
 * every other sort stays on the cheaper lookup-free path below.
 */
const ratingLookupStages = () => [
  {
    $lookup: {
      from: TeacherProfile.collection.name,
      localField: "ownerId",
      foreignField: "userId",
      as: "_teacherProfile",
    },
  },
  {
    $addFields: {
      avgRating: { $ifNull: [{ $arrayElemAt: ["$_teacherProfile.avgRating", 0] }, 0] },
      reviewCount: { $ifNull: [{ $arrayElemAt: ["$_teacherProfile.reviewCount", 0] }, 0] },
      verificationStatus: { $ifNull: [{ $arrayElemAt: ["$_teacherProfile.verificationStatus", 0] }, "none"] },
    },
  },
  { $project: { _teacherProfile: 0 } },
];

// ─── Phase 12: learning-to-rank blend ("sort=recommended") ──────────────────

const RATING_SCALE_MAX = 5; // avgRating is stored 0-5
const REVIEW_COUNT_SATURATION = 20; // reviewCount treated as "maximally trusted" at this many or more

// Used until ml-jobs/'s offline LightGBM job has written a real
// RankingConfig (never run yet, or the collection was cleared) — a
// reasonable static default so sort=recommended behaves sensibly, not
// brokenly, before Phase 12's learned weights exist.
const DEFAULT_RANKING_WEIGHTS = { rating: 40, reviewCount: 20, verification: 40 };

const getRankingWeights = async () => {
  const config = await RankingConfig.findById("listing_ranking");
  return config?.weights || DEFAULT_RANKING_WEIGHTS;
};

/**
 * Computes a single blended `learnedScore` field from the rating/
 * reviewCount/verificationStatus fields ratingLookupStages() above already
 * added — the weights come from Python's offline LightGBM ranking run
 * (feature importances, normalized to this same three-field shape) rather
 * than being hand-tuned here. Distance isn't part of this blend; a geo
 * search keeps using $geoNear's distanceMeters as the sort tiebreak, same
 * as every other sort option.
 */
const learnedScoreStage = (weights) => ({
  $addFields: {
    learnedScore: {
      $add: [
        { $multiply: [{ $divide: ["$avgRating", RATING_SCALE_MAX] }, weights.rating] },
        { $multiply: [{ $min: [{ $divide: ["$reviewCount", REVIEW_COUNT_SATURATION] }, 1] }, weights.reviewCount] },
        {
          $multiply: [
            {
              $switch: {
                branches: [
                  { case: { $eq: ["$verificationStatus", "fully_verified"] }, then: 1 },
                  { case: { $eq: ["$verificationStatus", "id_verified"] }, then: 0.5 },
                ],
                default: 0,
              },
            },
            weights.verification,
          ],
        },
      ],
    },
  },
});

/**
 * Public listing search — the query-string-driven version of
 * publicVisibilityQueryFilter above, plus subject/grade/medium/curriculum/
 * price filters and an optional geospatial "near me" search.
 *
 * Sort-relevant concerns compose independently: geo (changes the pipeline's
 * leading stage — $geoNear must run first — and adds distanceMeters),
 * rating/recommended (both need the $lookup spliced in before sorting;
 * recommended additionally computes a learnedScore field from Phase 12's
 * weights), and everything else (plain field sort). Any of geo/rating/
 * recommended pushes this onto the aggregation path; a plain `.find()`
 * covers the common case where none apply, without paying for a $lookup or
 * $geoNear it doesn't need.
 */
/**
 * The hard-constraint filter shared by plain browse (Phase 6B) and
 * semantic search (Phase 16, search.service.js) — visibility rules plus
 * subject/grade/medium/curriculum/price. Exported so semantic search
 * combines the SAME structured constraints with its embedding-based
 * ranking rather than re-deriving (and risking drifting from) this logic a
 * second time — "don't let the embedding guess at things the user already
 * told you precisely" only holds if both search paths agree on what
 * "precisely" means.
 */
export const buildListingStructuredFilter = (
  requester,
  { subject, grade, medium, curriculum, minPrice, maxPrice, ownerId } = {}
) => {
  const filter = { ...publicVisibilityQueryFilter(requester) };

  // One owner's active listings — the public teacher profile page's
  // "active listings" section. Visibility rules above still apply.
  if (ownerId) filter.ownerId = new mongoose.Types.ObjectId(String(ownerId));

  if (subject) filter.subject = caseInsensitiveExact(subject);
  if (grade) filter.grade = caseInsensitiveExact(grade);
  if (medium) filter.medium = medium;
  if (curriculum) filter.curriculum = curriculum;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter["price.amount"] = {};
    if (minPrice !== undefined) filter["price.amount"].$gte = Number(minPrice);
    if (maxPrice !== undefined) filter["price.amount"].$lte = Number(maxPrice);
  }

  return filter;
};

export const browseListings = async (requester, query) => {
  const { lat, lng, radiusKm, sort = "newest", page = 1, limit = 20 } = query;

  const filter = buildListingStructuredFilter(requester, query);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const hasGeo = lat !== undefined && lng !== undefined;
  const needsRecommended = sort === "recommended";
  const needsRatingLookup = sort === "rating" || needsRecommended;

  if (hasGeo || needsRatingLookup) {
    const leadingStage = hasGeo
      ? {
          $geoNear: {
            near: { type: "Point", coordinates: [Number(lng), Number(lat)] },
            distanceField: "distanceMeters",
            spherical: true,
            query: filter,
            ...(radiusKm !== undefined ? { maxDistance: Number(radiusKm) * 1000 } : {}),
          },
        }
      : { $match: filter };

    let sortStage;
    let scoringStages = [];
    if (needsRecommended) {
      const weights = await getRankingWeights();
      scoringStages = [learnedScoreStage(weights)];
      sortStage = { learnedScore: -1, ...(hasGeo ? { distanceMeters: 1 } : { createdAt: -1 }) };
    } else {
      sortStage = hasGeo ? GEO_SORTS[sort] || GEO_SORTS.newest : NON_GEO_SORTS[sort] || NON_GEO_SORTS.newest;
    }

    // A single leading stage (geoNear or match) feeding two $facet branches
    // — the expensive part (geo index scan and/or the rating $lookup) runs
    // once and is reused for both the data page and the count, instead of
    // running it twice across two separate aggregate() calls.
    const [result] = await Listing.aggregate([
      leadingStage,
      ...(needsRatingLookup ? ratingLookupStages() : []),
      ...scoringStages,
      {
        $facet: {
          data: [{ $sort: sortStage }, { $skip: skip }, { $limit: limitNum }],
          totalCount: [{ $count: "total" }],
        },
      },
    ]);

    return {
      listings: result?.data || [],
      pagination: { page: pageNum, limit: limitNum, total: result?.totalCount?.[0]?.total || 0 },
    };
  }

  const sortSpec = NON_GEO_SORTS[sort] || NON_GEO_SORTS.newest;

  const [listings, total] = await Promise.all([
    Listing.find(filter).sort(sortSpec).skip(skip).limit(limitNum),
    Listing.countDocuments(filter),
  ]);

  return {
    listings,
    pagination: { page: pageNum, limit: limitNum, total },
  };
};

// ─── Phase 16: teacher-facing pricing assistant ─────────────────────────────

const MIN_SAMPLES_FOR_SUGGESTION = 3; // below this, a percentile is more misleading than useful

/**
 * A percentile read of what teachers currently charge for a subject/grade/
 * medium — not ML, just a distribution query, but genuinely useful for a
 * teacher pricing a new ad and cheap to add since browseListings already
 * queries this same data shape.
 */
export const getPriceSuggestion = async ({ subject, grade, medium }) => {
  const filter = { type: "teacher_ad", status: "active", "price.amount": { $exists: true } };
  if (subject) filter.subject = caseInsensitiveExact(subject);
  if (grade) filter.grade = caseInsensitiveExact(grade);
  if (medium) filter.medium = medium;

  const listings = await Listing.find(filter).select("price.amount");
  const amounts = listings.map((l) => l.price.amount).sort((a, b) => a - b);

  if (amounts.length < MIN_SAMPLES_FOR_SUGGESTION) {
    return { sampleSize: amounts.length, suggestion: null };
  }

  const percentile = (p) => amounts[Math.min(amounts.length - 1, Math.floor((p / 100) * amounts.length))];

  return {
    sampleSize: amounts.length,
    suggestion: { p25: percentile(25), median: percentile(50), p75: percentile(75) },
  };
};
