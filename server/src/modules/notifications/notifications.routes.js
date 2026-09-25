import { Router } from "express";
import * as notificationsController from "./notifications.controller.js";
import { listNotificationsValidation, notificationIdParamValidation } from "./notifications.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * GET /api/notifications
 * Protected — the caller's own notifications only, unread-first. No
 * WebSockets (per the roadmap's Phase 9 scoping) — the frontend polls this
 * every 30-60s in Phase 9F.
 */
router.get("/", authenticate, listNotificationsValidation, validate, notificationsController.listNotifications);

/**
 * PATCH /api/notifications/read-all
 * Protected — registered before /:id/read so "read-all" is never parsed as an id.
 */
router.patch("/read-all", authenticate, notificationsController.markAllNotificationsRead);

/**
 * PATCH /api/notifications/:id/read
 * Protected, owner only — enforced by scoping the lookup to req.user.id in
 * notifications.service.js (404, not 403, for someone else's notification).
 */
router.patch(
  "/:id/read",
  authenticate,
  notificationIdParamValidation,
  validate,
  notificationsController.markNotificationRead
);

export default router;
