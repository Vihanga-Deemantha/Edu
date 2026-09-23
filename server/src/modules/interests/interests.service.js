import InterestRequest from "../../models/InterestRequest.js";
import Listing from "../../models/Listing.js";
import User from "../../models/User.js";
import TeacherVerification from "../../models/TeacherVerification.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf, resolveOwnedUserIds } from "../../utils/familyAccess.js";
import { getListingById } from "../listings/listings.service.js";

/**
 * Interest requests run in either direction depending on the listing type:
 * a student/parent expresses interest in a teacher_ad (fromUserId =
 * student/child, toUserId = teacher), or a teacher expresses interest in a
 * student_ad (fromUserId = teacher, toUserId = student/child). Which side
 * (if either) is child-linked and which is the teacher is resolved per
 * request from User.parentId/role, never assumed from direction — see
 * resolveVerificationGate below.
 */

// ─── CREATE ──────────────────────────────────────────────────────────────────

/**
 * Mirrors resolveOwnerId's role handling in listings.service.js: who is
 * allowed to be the "from" side is the opposite of who owns this listing
 * type. A parent must name which linked child the interest is for, same
 * targetUserId pattern used for posting a student_ad on a child's behalf.
 */
const resolveFromUserId = async ({ listing, requesterId, requesterRole, targetUserId }) => {
  if (listing.type === "teacher_ad") {
    if (requesterRole === "student") return requesterId;
    if (requesterRole === "parent") {
      if (!targetUserId) {
        throw new ApiError(
          400,
          "targetUserId (the child this interest is for) is required when a parent sends interest.",
          "TARGET_USER_REQUIRED"
        );
      }
      if (!(await isRequesterParentOf(requesterId, targetUserId))) {
        throw new ApiError(
          403,
          "You can only express interest on behalf of yourself or a linked child account.",
          "FORBIDDEN"
        );
      }
      return targetUserId;
    }
    throw new ApiError(403, "Only a student or parent can express interest in a teacher listing.", "ROLE_MISMATCH");
  }

  // student_ad
  if (requesterRole !== "teacher") {
    throw new ApiError(403, "Only a teacher can express interest in a student listing.", "ROLE_MISMATCH");
  }
  return requesterId;
};

/**
 * POST /api/interests. Visibility (existence + role-gated read access) is
 * enforced by reusing Phase 4's getListingById rather than re-deriving it —
 * a non-teacher can't even see a student_ad well enough to interest in it,
 * and a closed/flagged listing 404s the same way it does everywhere else.
 */
export const createInterestRequest = async ({ requesterId, requesterRole, listingId, targetUserId, message }) => {
  const listing = await getListingById(listingId, { id: requesterId, role: requesterRole });
  const fromUserId = await resolveFromUserId({ listing, requesterId, requesterRole, targetUserId });

  if (String(fromUserId) === String(listing.ownerId)) {
    throw new ApiError(400, "You cannot express interest in your own listing.", "SELF_INTEREST");
  }

  try {
    const interestRequest = await InterestRequest.create({
      listingId,
      fromUserId,
      toUserId: listing.ownerId,
      message,
    });
    return { interestRequest, listing };
  } catch (err) {
    // Race-free duplicate guard — see the partial unique index on
    // InterestRequest (listingId + fromUserId, status: pending only).
    if (err.code === 11000) {
      throw new ApiError(
        409,
        "You already have a pending interest request for this listing.",
        "INTEREST_ALREADY_PENDING"
      );
    }
    throw err;
  }
};

// ─── RESPOND (accept/decline) ────────────────────────────────────────────────

const canRespond = async (requesterId, requesterRole, interestRequest) => {
  if (String(interestRequest.toUserId) === String(requesterId)) return true;
  if (requesterRole === "parent") return isRequesterParentOf(requesterId, interestRequest.toUserId);
  return false;
};

/**
 * Resolves both participants of an interest request and which side (if
 * either) is the teacher — the teacher could be fromUserId or toUserId
 * depending on which direction the request ran (see the module-level
 * comment above). Shared by the verification gate below and by Phase 11B's
 * reviews, where a review's teacherId + allowed reviewer are derived from
 * this exact same resolution, never trusted from the client.
 */
export const resolveInterestSides = async (interestRequest) => {
  const [fromUser, toUser] = await Promise.all([
    User.findById(interestRequest.fromUserId),
    User.findById(interestRequest.toUserId),
  ]);
  const teacherUser = fromUser?.role === "teacher" ? fromUser : toUser?.role === "teacher" ? toUser : null;
  const nonTeacherUser = teacherUser === fromUser ? toUser : fromUser;
  return { fromUser, toUser, teacherUser, nonTeacherUser };
};

/**
 * Phase 0 upgrade §C3: a request that involves a child-linked account can
 * only be ACCEPTED once the teacher side is fully_verified — regardless of
 * which direction the request ran, and regardless of who is technically
 * clicking accept (a parent accepting on a child's behalf is still gated
 * the same way). Checked against TeacherVerification.verificationTier
 * directly — the source of truth — not TeacherProfile's mirrored copy,
 * since this is a trust/safety gate protecting a child, not a display
 * concern where a mirror is fine.
 */
const enforceVerificationGate = async (fromUser, toUser, teacherUser) => {
  const childInvolved = Boolean(fromUser.parentId) || Boolean(toUser.parentId);
  if (!teacherUser || !childInvolved) return;

  const verification = await TeacherVerification.findOne({ userId: teacherUser._id });
  if (verification?.verificationTier !== "fully_verified") {
    throw new ApiError(
      403,
      "This request involves a child-linked account and can only be accepted by a fully verified teacher.",
      "TEACHER_NOT_FULLY_VERIFIED"
    );
  }
};

/**
 * PATCH /api/interests/:id/respond. Returns the listing alongside the
 * updated request purely so the controller can build a notification payload
 * without a redundant fetch of its own.
 */
export const respondToInterestRequest = async ({ interestId, requesterId, requesterRole, status }) => {
  const interestRequest = await InterestRequest.findById(interestId);
  if (!interestRequest) {
    throw new ApiError(404, "Interest request not found", "INTEREST_NOT_FOUND");
  }
  if (!(await canRespond(requesterId, requesterRole, interestRequest))) {
    throw new ApiError(403, "You do not have permission to respond to this request.", "FORBIDDEN");
  }
  if (interestRequest.status !== "pending") {
    throw new ApiError(400, `This request has already been ${interestRequest.status}.`, "INVALID_STATE");
  }

  if (status === "accepted") {
    const { fromUser, toUser, teacherUser } = await resolveInterestSides(interestRequest);
    await enforceVerificationGate(fromUser, toUser, teacherUser);
  }

  interestRequest.status = status;
  interestRequest.respondedAt = new Date();
  await interestRequest.save();

  const listing = await Listing.findById(interestRequest.listingId).select("subject");
  return { interestRequest, listing };
};

// ─── COMPLETE ────────────────────────────────────────────────────────────────

/**
 * Which side (if either) the requester is acting as — "from", "to", or null
 * if they're not a participant at all (self directly, or via a linked
 * child). Used as the access check for complete() (and to know which side to
 * notify — the one that DIDN'T just act), and exported for Phase 17B's
 * bookings.service.js to reuse the exact same parent-of-child resolution
 * against Booking's teacherId/studentId instead of fromUserId/toUserId —
 * only the field names differ, so it's the same operation, not a lookalike.
 * Only takes an object with fromUserId/toUserId, not a real InterestRequest
 * specifically.
 */
export const resolveActingSide = async (requesterId, requesterRole, interestRequest) => {
  if (String(interestRequest.fromUserId) === String(requesterId)) return "from";
  if (String(interestRequest.toUserId) === String(requesterId)) return "to";
  if (requesterRole === "parent") {
    if (await isRequesterParentOf(requesterId, interestRequest.fromUserId)) return "from";
    if (await isRequesterParentOf(requesterId, interestRequest.toUserId)) return "to";
  }
  return null;
};

/** PATCH /api/interests/:id/complete — either participant, once accepted. */
export const completeInterestRequest = async ({ interestId, requesterId, requesterRole }) => {
  const interestRequest = await InterestRequest.findById(interestId);
  if (!interestRequest) {
    throw new ApiError(404, "Interest request not found", "INTEREST_NOT_FOUND");
  }

  const actingSide = await resolveActingSide(requesterId, requesterRole, interestRequest);
  if (!actingSide) {
    throw new ApiError(403, "You do not have permission to modify this request.", "FORBIDDEN");
  }
  if (interestRequest.status !== "accepted") {
    throw new ApiError(400, "Only an accepted request can be marked completed.", "INVALID_STATE");
  }

  interestRequest.status = "completed";
  await interestRequest.save();

  const listing = await Listing.findById(interestRequest.listingId).select("subject");
  const notifyUserId = actingSide === "from" ? interestRequest.toUserId : interestRequest.fromUserId;
  return { interestRequest, listing, notifyUserId };
};

// ─── READ ────────────────────────────────────────────────────────────────────

/**
 * On accepted/completed, resolves to real, reachable contact info for both
 * sides — substituting the PARENT's when a side is child-linked (Phase 0's
 * data-minimization decision: contact revealed is always the parent's,
 * never the child's — doubly necessary here since a child's own stored
 * email/phone are random unreachable placeholders, not just withheld).
 * Omitted entirely while still pending/declined.
 */
const resolveContact = async (user) => {
  const contactUser = user.parentId ? await User.findById(user.parentId) : user;
  if (!contactUser) return null;
  return { name: contactUser.name, email: contactUser.email, phone: contactUser.phone };
};

export const serializeInterestRequest = async (interestRequest) => {
  const serialized = interestRequest.toObject();
  if (interestRequest.status === "accepted" || interestRequest.status === "completed") {
    const [fromUser, toUser] = await Promise.all([
      User.findById(interestRequest.fromUserId),
      User.findById(interestRequest.toUserId),
    ]);
    serialized.fromContact = fromUser ? await resolveContact(fromUser) : null;
    serialized.toContact = toUser ? await resolveContact(toUser) : null;
  }
  return serialized;
};

const paginatedInterests = async (filter, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    InterestRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    InterestRequest.countDocuments(filter),
  ]);

  const interests = await Promise.all(items.map(serializeInterestRequest));
  return { interests, pagination: { page: pageNum, limit: limitNum, total } };
};

/** GET /api/interests/sent — the caller's own, plus (for a parent) every linked child's. */
export const getSentInterests = async (requesterId, requesterRole, pagination) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  return paginatedInterests({ fromUserId: { $in: userIds } }, pagination);
};

/** GET /api/interests/received — symmetric to getSentInterests above. */
export const getReceivedInterests = async (requesterId, requesterRole, pagination) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  return paginatedInterests({ toUserId: { $in: userIds } }, pagination);
};
