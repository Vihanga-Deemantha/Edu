import Notification from "../../models/Notification.js";
import ApiError from "../../utils/ApiError.js";
import { resolveOwnedUserIds } from "../../utils/familyAccess.js";

/**
 * GET /api/notifications — a parent's own notifications plus every linked
 * child's (a child never authenticates, so a notification stored under a
 * child's userId — e.g. about a child-linked interest request — would
 * otherwise be permanently unreachable by anyone). Unread-first (read: false
 * sorts before true ascending), newest-first within each group.
 */
export const listNotifications = async (requesterId, requesterRole, { page = 1, limit = 20 } = {}) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  const filter = { userId: { $in: userIds } };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ read: 1, createdAt: -1 }).skip(skip).limit(limitNum),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read: false }),
  ]);

  return { notifications, pagination: { page: pageNum, limit: limitNum, total }, unreadCount };
};

/**
 * PATCH /api/notifications/:id/read — scoping the lookup to the requester's
 * own-or-linked-child userIds does double duty: it's the ownership check AND
 * it means a notification outside that set 404s instead of leaking whether
 * that id exists at all.
 */
export const markNotificationRead = async ({ notificationId, requesterId, requesterRole }) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  const notification = await Notification.findOne({ _id: notificationId, userId: { $in: userIds } });
  if (!notification) {
    throw new ApiError(404, "Notification not found", "NOTIFICATION_NOT_FOUND");
  }
  notification.read = true;
  await notification.save();
  return notification;
};

/**
 * PATCH /api/notifications/read-all — the same own-or-linked-child scope as
 * the list endpoint above, so "mark all read" clears exactly what the
 * caller can see and nothing else.
 */
export const markAllNotificationsRead = async ({ requesterId, requesterRole }) => {
  const userIds = await resolveOwnedUserIds(requesterId, requesterRole);
  const result = await Notification.updateMany({ userId: { $in: userIds }, read: false }, { $set: { read: true } });
  return { updated: result.modifiedCount };
};
