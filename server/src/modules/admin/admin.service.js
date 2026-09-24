import TeacherVerification from "../../models/TeacherVerification.js";
import User from "../../models/User.js";
import Listing from "../../models/Listing.js";
import Report from "../../models/Report.js";
import RefreshToken from "../../models/RefreshToken.js";
import AuditLog from "../../models/AuditLog.js";
import ApiError from "../../utils/ApiError.js";
import { syncTeacherVerificationStatus } from "../profiles/profiles.service.js";
import { userEvents, USER_SUSPENDED } from "../../events/userEvents.js";

/**
 * Awaited at every call site below, unlike Event/Notification's
 * fire-and-forget writes — an audit log exists specifically to be a
 * reliable record for a disputed moderation decision, so a silently-lost
 * write would defeat its entire purpose. A failure here surfaces as a real
 * error on the admin's request rather than vanishing.
 */
const writeAuditLog = (adminId, action, targetType, targetId, metadata = {}) =>
  AuditLog.create({ adminId, action, targetType, targetId, metadata });

/**
 * PATCH /api/admin/verification/:userId — approve or reject a teacher's
 * submitted verification, setting the tier explicitly (not derived from
 * approve/reject) so an admin has full direct control, e.g. approving at
 * id_verified without granting fully_verified.
 */
export const reviewVerification = async ({ adminId, userId, verificationTier, status, adminNotes }) => {
  const verification = await TeacherVerification.findOne({ userId });
  if (!verification) {
    throw new ApiError(404, "No verification submission found for this teacher", "VERIFICATION_NOT_FOUND");
  }

  verification.verificationTier = verificationTier;
  verification.status = status;
  verification.adminNotes = adminNotes || null;
  verification.adminReviewerId = adminId;
  verification.reviewedAt = new Date();
  await verification.save();

  // The public-facing TeacherProfile is kept in sync immediately, in the
  // same request — the Definition of Done's explicit requirement, not a
  // background job that could lag.
  await syncTeacherVerificationStatus(userId, verificationTier);

  await writeAuditLog(adminId, "verification_reviewed", "verification", verification._id, {
    userId,
    verificationTier,
    status,
  });

  return verification;
};

/** PATCH /api/admin/users/:userId/suspend */
export const suspendUser = async ({ adminId, userId, adminNotes }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }
  if (user.role === "admin") {
    throw new ApiError(400, "Cannot suspend an admin account.", "CANNOT_SUSPEND_ADMIN");
  }

  user.isActive = false;
  await user.save();

  // isActive alone only blocks a FUTURE login (see auth.service.js's
  // loginUser) — without also revoking existing sessions, an
  // already-logged-in user could keep refreshing for up to the refresh
  // token's full lifetime (7 days by default) after being suspended.
  await RefreshToken.deleteMany({ userId });

  // REST sessions are now cut off (above), but a socket connection isn't a
  // request — it isn't re-authenticated after its initial handshake, so
  // without this it would keep working indefinitely, undercutting
  // "immediate session revocation." sockets/chatSocket.js subscribes to
  // this and disconnects every live socket for this user; admin.service.js
  // deliberately has no direct Socket.io dependency of its own.
  userEvents.emit(USER_SUSPENDED, String(userId));

  await writeAuditLog(adminId, "user_suspended", "user", user._id, { adminNotes: adminNotes || null });

  return user;
};

/** PATCH /api/admin/users/:userId/unsuspend — reverses a suspension. */
export const unsuspendUser = async ({ adminId, userId, adminNotes }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found", "USER_NOT_FOUND");
  }

  user.isActive = true;
  await user.save();

  await writeAuditLog(adminId, "user_unsuspended", "user", user._id, { adminNotes: adminNotes || null });

  return user;
};

/** PATCH /api/admin/listings/:id/moderate — status is explicit (flagged or
 * back to active), not a one-way switch, so a moderation review actually
 * has a resolution path once a listing turns out to be fine. */
export const moderateListing = async ({ adminId, listingId, status, adminNotes }) => {
  const listing = await Listing.findById(listingId);
  if (!listing) {
    throw new ApiError(404, "Listing not found", "LISTING_NOT_FOUND");
  }

  listing.status = status;
  await listing.save();

  await writeAuditLog(adminId, "listing_moderated", "listing", listing._id, {
    status,
    adminNotes: adminNotes || null,
  });

  return listing;
};

/** GET /api/admin/reports — optionally filtered by status, newest first. */
export const getReports = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [reports, total] = await Promise.all([
    Report.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Report.countDocuments(filter),
  ]);

  return { reports, pagination: { page: pageNum, limit: limitNum, total } };
};

/** PATCH /api/admin/reports/:id/resolve */
export const resolveReport = async ({ adminId, reportId, status, adminNotes }) => {
  const report = await Report.findById(reportId);
  if (!report) {
    throw new ApiError(404, "Report not found", "REPORT_NOT_FOUND");
  }

  report.status = status;
  await report.save();

  await writeAuditLog(adminId, "report_resolved", "report", report._id, {
    status,
    adminNotes: adminNotes || null,
  });

  return report;
};
