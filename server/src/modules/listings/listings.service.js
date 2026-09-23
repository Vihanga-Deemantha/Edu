import Listing from "../../models/Listing.js";
import TeacherProfile from "../../models/TeacherProfile.js";
import StudentProfile from "../../models/StudentProfile.js";
import User from "../../models/User.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf } from "../../utils/familyAccess.js";

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

export const createListing = async ({ requesterId, requesterRole, targetUserId, location, price, ...fields }) => {
  const ownerId = await resolveOwnerId({ type: fields.type, requesterId, requesterRole, targetUserId });
  const resolvedLocation = await denormalizeLocation(fields.type, ownerId, location);

  return Listing.create({
    ...fields,
    ownerId,
    location: resolvedLocation,
    price: normalizePrice(price),
  });
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
  const ownerIds = [requesterId];
  if (requesterRole === "parent") {
    const parent = await User.findById(requesterId);
    for (const childId of parent?.linkedChildIds || []) {
      ownerIds.push(String(childId));
    }
  }
  return Listing.find({ ownerId: { $in: ownerIds } }).sort({ createdAt: -1 });
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
  // "rating" has nowhere to read from yet — avgRating lives on TeacherProfile,
  // not Listing, and nothing has denormalized or joined it here. Falls back
  // to newest until Phase 11B lands and this gets revisited (either
  // denormalize avgRating onto Listing, or add a $lookup here).
  rating: { createdAt: -1 },
};

const GEO_SORTS = {
  price: { "price.amount": 1 },
  distance: { distanceMeters: 1 },
  newest: { createdAt: -1 },
  rating: { distanceMeters: 1 }, // same caveat as NON_GEO_SORTS.rating
};

/**
 * Public listing search — the query-string-driven version of
 * publicVisibilityQueryFilter above, plus subject/grade/medium/curriculum/
 * price filters and an optional geospatial "near me" search.
 *
 * $geoNear (when lat/lng are given) must be the pipeline's first stage, so
 * geo and non-geo search run through genuinely different query shapes
 * rather than trying to force one code path to cover both — a plain
 * `.find()` for the common non-geo case, an aggregation pipeline only when
 * a geo search is actually being done.
 */
export const browseListings = async (requester, query) => {
  const {
    subject, grade, medium, curriculum,
    minPrice, maxPrice,
    lat, lng, radiusKm,
    sort = "newest",
    page = 1,
    limit = 20,
  } = query;

  const filter = { ...publicVisibilityQueryFilter(requester) };

  if (subject) filter.subject = caseInsensitiveExact(subject);
  if (grade) filter.grade = caseInsensitiveExact(grade);
  if (medium) filter.medium = medium;
  if (curriculum) filter.curriculum = curriculum;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter["price.amount"] = {};
    if (minPrice !== undefined) filter["price.amount"].$gte = Number(minPrice);
    if (maxPrice !== undefined) filter["price.amount"].$lte = Number(maxPrice);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const hasGeo = lat !== undefined && lng !== undefined;

  if (hasGeo) {
    const geoStage = {
      $geoNear: {
        near: { type: "Point", coordinates: [Number(lng), Number(lat)] },
        distanceField: "distanceMeters",
        spherical: true,
        query: filter,
        ...(radiusKm !== undefined ? { maxDistance: Number(radiusKm) * 1000 } : {}),
      },
    };
    const sortStage = GEO_SORTS[sort] || GEO_SORTS.newest;

    // A single $geoNear feeding two $facet branches — the geospatial index
    // scan + distance computation runs once and is reused for both the data
    // page and the count, instead of two separate aggregate() calls each
    // re-running $geoNear from scratch for the same request.
    const [result] = await Listing.aggregate([
      geoStage,
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
