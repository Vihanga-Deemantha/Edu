import Review from "../../models/Review.js";
import InterestRequest from "../../models/InterestRequest.js";
import TeacherProfile from "../../models/TeacherProfile.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf } from "../../utils/familyAccess.js";
import { resolveInterestSides } from "../interests/interests.service.js";

/**
 * Recomputes from the authoritative Review collection rather than
 * incrementing a running average — self-correcting under concurrent writes
 * (whichever review finishes last always leaves the true aggregate, since
 * each write reads current state fresh) and avoids the class of drift bugs
 * an incremental update invites. Review volume here never justifies the
 * incremental version's efficiency trade-off.
 */
const recomputeTeacherRating = async (teacherId) => {
  const [result] = await Review.aggregate([
    { $match: { teacherId } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, reviewCount: { $sum: 1 } } },
  ]);

  await TeacherProfile.findOneAndUpdate(
    { userId: teacherId },
    { $set: { avgRating: result?.avgRating || 0, reviewCount: result?.reviewCount || 0 } }
  );
};

/**
 * POST /api/reviews. teacherId and reviewerId are never taken from the
 * client — both are derived from linkedRequestId via resolveInterestSides,
 * the same teacher-side resolution the accept-time verification gate uses,
 * since the teacher could be either side of the interest request depending
 * on which direction it ran.
 */
export const createReview = async ({ requesterId, requesterRole, linkedRequestId, rating, comment }) => {
  const interestRequest = await InterestRequest.findById(linkedRequestId);
  if (!interestRequest) {
    throw new ApiError(404, "Interest request not found", "INTEREST_NOT_FOUND");
  }
  if (interestRequest.status !== "completed") {
    throw new ApiError(400, "You can only review a completed engagement.", "INVALID_STATE");
  }

  const { teacherUser, nonTeacherUser } = await resolveInterestSides(interestRequest);
  if (!teacherUser || !nonTeacherUser) {
    throw new ApiError(400, "This request has no teacher/student pairing to review.", "INVALID_STATE");
  }

  const isReviewer =
    String(nonTeacherUser._id) === String(requesterId) ||
    (requesterRole === "parent" && (await isRequesterParentOf(requesterId, nonTeacherUser._id)));
  if (!isReviewer) {
    throw new ApiError(403, "You can only review your own completed engagements.", "FORBIDDEN");
  }

  let review;
  try {
    review = await Review.create({
      teacherId: teacherUser._id,
      reviewerId: nonTeacherUser._id,
      rating,
      comment,
      linkedRequestId,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new ApiError(409, "This engagement has already been reviewed.", "ALREADY_REVIEWED");
    }
    throw err;
  }

  await recomputeTeacherRating(teacherUser._id);
  return review;
};

/**
 * GET /api/reviews/teacher/:teacherId — public. Deliberately projects down
 * to rating/comment/createdAt only: reviewerId is never exposed here, since
 * it can point at a child's account (Phase 0's data-minimization decision —
 * a child's identity is never surfaced on a public page, same reasoning as
 * TeacherProfile stripping verificationStatus to a badge for public reads).
 */
export const getTeacherReviews = async (teacherId, { page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const filter = { teacherId };
  const [reviews, total] = await Promise.all([
    Review.find(filter).select("rating comment createdAt").sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Review.countDocuments(filter),
  ]);

  return { reviews, pagination: { page: pageNum, limit: limitNum, total } };
};
