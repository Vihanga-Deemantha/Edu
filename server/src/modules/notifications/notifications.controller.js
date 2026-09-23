import * as notificationsService from "./notifications.service.js";

// ─── GET /api/notifications  (protected) ─────────────────────────────────────
export const listNotifications = async (req, res, next) => {
  try {
    const { notifications, pagination, unreadCount } = await notificationsService.listNotifications(
      req.user.id,
      req.user.role,
      req.query
    );
    res.status(200).json({ success: true, data: { notifications, pagination, unreadCount } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/notifications/:id/read  (protected, owner only) ─────────────
export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await notificationsService.markNotificationRead({
      notificationId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json({ success: true, data: { notification } });
  } catch (err) {
    next(err);
  }
};
