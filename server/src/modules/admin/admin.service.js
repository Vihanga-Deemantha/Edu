import TeacherVerification from "../../models/TeacherVerification.js";
import User from "../../models/User.js";
import Listing from "../../models/Listing.js";
import Report from "../../models/Report.js";
import RefreshToken from "../../models/RefreshToken.js";
import AuditLog from "../../models/AuditLog.js";
import TeacherProfile from "../../models/TeacherProfile.js";
import Booking from "../../models/Booking.js";
import Payment from "../../models/Payment.js";
import Review from "../../models/Review.js";
import { summarizeUsers, attachListingOwners } from "../../utils/presenters.js";
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

  return { reports: await presentReports(reports), pagination: { page: pageNum, limit: limitNum, total } };
};

/**
 * Reporter name plus an inline summary of whatever was reported — the
 * review's text, the listing's subject/owner, or the user's name/role — so
 * an admin can judge a report without opening a second tab (spec §11.3).
 */
const presentReports = async (reports) => {
  if (reports.length === 0) return [];
  const idsOf = (type) => reports.filter((r) => r.targetType === type).map((r) => r.targetId);

  const [reviews, listings, targetUsers] = await Promise.all([
    Review.find({ _id: { $in: idsOf("review") } }).select("rating comment teacherId createdAt"),
    Listing.find({ _id: { $in: idsOf("listing") } }).select("type subject grade status ownerId"),
    User.find({ _id: { $in: idsOf("user") } }).select("isActive"),
  ]);
  const users = await summarizeUsers([
    ...reports.map((r) => r.reporterId),
    ...idsOf("user"),
    ...reviews.map((r) => r.teacherId),
    ...listings.map((l) => l.ownerId),
  ]);
  const activeById = new Map(targetUsers.map((u) => [String(u._id), u.isActive]));
  const reviewById = new Map(reviews.map((r) => [String(r._id), r]));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));

  return reports.map((report) => {
    const id = String(report.targetId);
    let target = null;
    if (report.targetType === "review" && reviewById.has(id)) {
      const review = reviewById.get(id);
      target = {
        rating: review.rating,
        comment: review.comment,
        teacherName: users.get(String(review.teacherId))?.name ?? null,
        createdAt: review.createdAt,
      };
    } else if (report.targetType === "listing" && listingById.has(id)) {
      const listing = listingById.get(id);
      target = {
        subject: listing.subject,
        grade: listing.grade,
        type: listing.type,
        status: listing.status,
        ownerId: listing.ownerId,
        ownerName: users.get(String(listing.ownerId))?.name ?? null,
      };
    } else if (report.targetType === "user" && users.has(id)) {
      const user = users.get(id);
      target = { name: user.name, role: user.role, isActive: activeById.get(id) ?? true };
    }
    const reporter = users.get(String(report.reporterId));
    return {
      ...report.toObject(),
      reporter: reporter ? { name: reporter.name, role: reporter.role } : null,
      target,
    };
  });
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

// ─── READ SIDE (admin console lists + dashboard) ─────────────────────────────

const paginate = ({ page = 1, limit = 20 } = {}) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/** The last `count` calendar months (UTC), oldest first, as YYYY-MM keys. */
const lastMonths = (count) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) =>
    monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1)))
  );
};

const countsById = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));

/**
 * GET /api/admin/stats — everything the admin dashboard renders, computed
 * from real collections: user split, verification tiers and review
 * turnaround, booking and deposit volume per month, and queue counts.
 * rangeDays scopes the "recent" figures (new teachers, review turnaround,
 * rejection rate); the monthly series always covers the last 12 months.
 */
export const getStats = async ({ rangeDays = 30 } = {}) => {
  const days = Math.min(366, Math.max(1, parseInt(rangeDays, 10) || 30));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const months = lastMonths(12);
  const seriesStart = new Date(`${months[0]}-01T00:00:00Z`);

  const [
    roleCounts,
    newTeachers,
    suspendedCount,
    tierCounts,
    verificationStatusCounts,
    reviewedRecent,
    bookingMonthly,
    bookingStatusCounts,
    depositMonthly,
    pendingReports,
    flaggedListings,
    activeListings,
  ] = await Promise.all([
    User.aggregate([{ $match: { role: { $ne: "admin" } } }, { $group: { _id: "$role", n: { $sum: 1 } } }]),
    User.countDocuments({ role: "teacher", createdAt: { $gte: since } }),
    User.countDocuments({ isActive: false }),
    TeacherProfile.aggregate([{ $group: { _id: "$verificationStatus", n: { $sum: 1 } } }]),
    TeacherVerification.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    TeacherVerification.find({ reviewedAt: { $gte: since }, submittedAt: { $ne: null } }).select(
      "status submittedAt reviewedAt"
    ),
    Booking.aggregate([
      { $match: { createdAt: { $gte: seriesStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, n: { $sum: 1 } } },
    ]),
    Booking.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { status: "paid", paidAt: { $gte: seriesStart } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } },
          amount: { $sum: "$amount" },
          n: { $sum: 1 },
          currency: { $first: "$currency" },
        },
      },
    ]),
    Report.countDocuments({ status: "pending" }),
    Listing.countDocuments({ status: "flagged" }),
    Listing.countDocuments({ status: "active" }),
  ]);

  const roles = countsById(roleCounts);
  const tiers = countsById(tierCounts);
  const verificationStatuses = countsById(verificationStatusCounts);
  const bookingStatuses = countsById(bookingStatusCounts);
  const bookingsByMonth = countsById(bookingMonthly);
  const depositsByMonth = new Map(depositMonthly.map((r) => [r._id, r]));

  const teacherProfiles = Object.values(tiers).reduce((a, b) => a + b, 0);
  const reviewHours = reviewedRecent.map((v) => (v.reviewedAt - v.submittedAt) / 3_600_000);
  const decided = reviewedRecent.filter((v) => v.status === "approved" || v.status === "rejected");
  const finished = (bookingStatuses.completed || 0) + (bookingStatuses.cancelled || 0);

  return {
    rangeDays: days,
    users: {
      teachers: roles.teacher || 0,
      students: roles.student || 0,
      parents: roles.parent || 0,
      newTeachers,
      suspended: suspendedCount,
    },
    verification: {
      pending: verificationStatuses.pending_review || 0,
      teacherProfiles,
      fullyVerified: tiers.fully_verified || 0,
      idVerified: tiers.id_verified || 0,
      avgReviewHours: reviewHours.length
        ? Math.round(reviewHours.reduce((a, b) => a + b, 0) / reviewHours.length)
        : null,
      rejectionRate: decided.length
        ? Math.round((decided.filter((v) => v.status === "rejected").length / decided.length) * 100)
        : null,
    },
    bookings: {
      monthly: months.map((month) => ({ month, count: bookingsByMonth[month] || 0 })),
      completionRate: finished ? Math.round(((bookingStatuses.completed || 0) / finished) * 100) : null,
      confirmed: bookingStatuses.confirmed || 0,
    },
    deposits: {
      currency: depositMonthly[0]?.currency || "usd",
      monthly: months.map((month) => ({
        month,
        amount: depositsByMonth.get(month)?.amount || 0,
        count: depositsByMonth.get(month)?.n || 0,
      })),
    },
    queues: {
      pendingVerifications: verificationStatuses.pending_review || 0,
      pendingReports,
      flaggedListings,
    },
    listings: { active: activeListings, flagged: flaggedListings },
  };
};

const VERIFICATION_STATUS_FILTERS = {
  pending: ["pending_review"],
  approved: ["approved"],
  rejected: ["rejected"],
  all: ["pending_review", "approved", "rejected", "expired"],
};

/** GET /api/admin/verifications — the review queue, oldest pending submission first. */
export const listVerifications = async ({ status = "pending", q, page, limit } = {}) => {
  const { pageNum, limitNum, skip } = paginate({ page, limit });
  const filter = { status: { $in: VERIFICATION_STATUS_FILTERS[status] || VERIFICATION_STATUS_FILTERS.pending } };
  if (q) {
    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    const users = await User.find({ role: "teacher", $or: [{ name: pattern }, { email: pattern }] }).select("_id");
    filter.userId = { $in: users.map((u) => u._id) };
  }

  const [verifications, total, statusCounts] = await Promise.all([
    TeacherVerification.find(filter)
      .sort({ submittedAt: status === "pending" ? 1 : -1 })
      .skip(skip)
      .limit(limitNum)
      .select("-nicNumber"),
    TeacherVerification.countDocuments(filter),
    TeacherVerification.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);

  const userIds = verifications.map((v) => v.userId);
  const [users, profiles] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name email"),
    TeacherProfile.find({ userId: { $in: userIds } }).select("userId subjects"),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const profileById = new Map(profiles.map((p) => [String(p.userId), p]));
  const counts = countsById(statusCounts);

  return {
    verifications: verifications.map((v) => {
      const user = userById.get(String(v.userId));
      return {
        userId: v.userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        subjects: profileById.get(String(v.userId))?.subjects ?? [],
        status: v.status,
        verificationTier: v.verificationTier,
        submittedAt: v.submittedAt,
        reviewedAt: v.reviewedAt,
        documentCount: 2 + (v.policeClearanceUrl ? 1 : 0) + (v.qualificationDocuments?.length || 0),
        hasPoliceClearance: Boolean(v.policeClearanceUrl),
      };
    }),
    counts: {
      pending: counts.pending_review || 0,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0,
      all: Object.values(counts).reduce((a, b) => a + b, 0),
    },
    pagination: { page: pageNum, limit: limitNum, total },
  };
};

/**
 * GET /api/admin/verifications/:userId — one submission in full for review.
 * Document files themselves are never inlined: the console fetches each one
 * through the existing short-lived signed-URL endpoint
 * (/api/verification/document/:userId/:field) only when an admin opens it.
 */
export const getVerificationDetail = async (userId) => {
  const verification = await TeacherVerification.findOne({ userId }).select("+adminNotes");
  if (!verification) {
    throw new ApiError(404, "No verification submission found for this teacher", "VERIFICATION_NOT_FOUND");
  }
  const [user, profile] = await Promise.all([
    User.findById(userId).select("name email phone createdAt"),
    TeacherProfile.findOne({ userId }).select("subjects grades medium experienceYears"),
  ]);

  return {
    userId,
    name: user?.name ?? null,
    email: user?.email ?? null,
    phone: user?.phone ?? null,
    memberSince: user?.createdAt ?? null,
    profile: profile ? profile.toObject() : null,
    nicNumber: verification.nicNumber,
    status: verification.status,
    verificationTier: verification.verificationTier,
    submittedAt: verification.submittedAt,
    reviewedAt: verification.reviewedAt,
    adminNotes: verification.adminNotes,
    qualificationDocuments: verification.qualificationDocuments,
    references: verification.references,
    policeClearanceIssuedAt: verification.policeClearanceIssuedAt,
    policeClearanceExpiresAt: verification.policeClearanceExpiresAt,
    documents: [
      { field: "nicDocumentUrl", label: "NIC / ID document", present: Boolean(verification.nicDocumentUrl) },
      { field: "selfieWithIdUrl", label: "Selfie with ID", present: Boolean(verification.selfieWithIdUrl) },
      { field: "policeClearanceUrl", label: "Police clearance", present: Boolean(verification.policeClearanceUrl) },
    ].filter((d) => d.present),
  };
};

/**
 * GET /api/admin/users — search by name/email, filter by role and active
 * status. Child accounts are excluded: they never log in, and every action
 * on them already goes through (and is shown under) their parent.
 */
export const listUsers = async ({ q, role, status, page, limit } = {}) => {
  const { pageNum, limitNum, skip } = paginate({ page, limit });
  const filter = { role: role || { $ne: "admin" }, parentId: null };
  if (status === "active") filter.isActive = true;
  if (status === "suspended") filter.isActive = false;
  if (q) {
    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [users, total, roleCounts] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select("name email phone role isActive createdAt linkedChildIds"),
    User.countDocuments(filter),
    User.aggregate([
      { $match: { role: { $ne: "admin" }, parentId: null } },
      { $group: { _id: "$role", n: { $sum: 1 } } },
    ]),
  ]);

  const teacherIds = users.filter((u) => u.role === "teacher").map((u) => u._id);
  const verifications = await TeacherVerification.find({ userId: { $in: teacherIds } }).select(
    "userId status verificationTier"
  );
  const verificationById = new Map(verifications.map((v) => [String(v.userId), v]));
  const counts = countsById(roleCounts);

  return {
    users: users.map((u) => {
      const v = verificationById.get(String(u._id));
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        childCount: u.linkedChildIds?.length || 0,
        verification:
          u.role === "teacher"
            ? { status: v?.status || "not_submitted", tier: v?.verificationTier || "none" }
            : null,
      };
    }),
    counts: {
      teacher: counts.teacher || 0,
      student: counts.student || 0,
      parent: counts.parent || 0,
      all: (counts.teacher || 0) + (counts.student || 0) + (counts.parent || 0),
    },
    pagination: { page: pageNum, limit: limitNum, total },
  };
};

/** GET /api/admin/users/:userId/audit — admin actions taken against one user. */
export const getUserAudit = async (userId) => {
  const logs = await AuditLog.find({ targetType: "user", targetId: userId }).sort({ createdAt: -1 }).limit(50);
  const admins = await summarizeUsers(logs.map((l) => l.adminId));
  return logs.map((log) => ({ ...log.toObject(), adminName: admins.get(String(log.adminId))?.name ?? null }));
};

/** GET /api/admin/listings — every listing regardless of visibility, for moderation. */
export const listListings = async ({ status, q, page, limit } = {}) => {
  const { pageNum, limitNum, skip } = paginate({ page, limit });
  const filter = {};
  if (status) filter.status = status;
  if (q) {
    const pattern = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ subject: pattern }, { grade: pattern }, { description: pattern }];
  }

  const [listings, total, statusCounts] = await Promise.all([
    Listing.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limitNum),
    Listing.countDocuments(filter),
    Listing.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const reportCounts = await Report.aggregate([
    { $match: { targetType: "listing", targetId: { $in: listings.map((l) => l._id) } } },
    {
      $group: {
        _id: "$targetId",
        n: { $sum: 1 },
        pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
      },
    },
  ]);
  const reportsById = new Map(reportCounts.map((r) => [String(r._id), r]));
  const counts = countsById(statusCounts);
  const presented = await attachListingOwners(listings);

  return {
    listings: presented.map((l) => ({
      ...l,
      reportCount: reportsById.get(String(l._id))?.n || 0,
      pendingReportCount: reportsById.get(String(l._id))?.pending || 0,
    })),
    counts: {
      active: counts.active || 0,
      flagged: counts.flagged || 0,
      closed: counts.closed || 0,
      all: Object.values(counts).reduce((a, b) => a + b, 0),
    },
    pagination: { page: pageNum, limit: limitNum, total },
  };
};
