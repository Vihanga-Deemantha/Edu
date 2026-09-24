import { Router } from "express";
import * as adminController from "./admin.controller.js";
import {
  reviewVerificationValidation,
  suspendUserValidation,
  unsuspendUserValidation,
  moderateListingValidation,
  listReportsValidation,
  resolveReportValidation,
} from "./admin.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

const router = Router();

// Every route in this module is admin-only — gated once here rather than
// per-route, since there's no partial-access case anywhere in this router.
router.use(authenticate, authorize("admin"));

/**
 * PATCH /api/admin/verification/:userId
 * Approves or rejects a teacher's verification submission and syncs the
 * change onto their public TeacherProfile in the same request.
 */
router.patch(
  "/verification/:userId",
  reviewVerificationValidation,
  validate,
  adminController.reviewVerification
);

/**
 * PATCH /api/admin/users/:userId/suspend
 * Sets isActive: false and immediately revokes every active session.
 */
router.patch("/users/:userId/suspend", suspendUserValidation, validate, adminController.suspendUser);

/**
 * PATCH /api/admin/users/:userId/unsuspend
 * Sets isActive: true — a real resolution path (an appeal, a mistaken
 * suspension), not a one-way switch. Session revocation on suspend was
 * already permanent (RefreshTokens are deleted, not just flagged), so
 * unsuspending only restores the ability to log in again, not any old session.
 */
router.patch("/users/:userId/unsuspend", unsuspendUserValidation, validate, adminController.unsuspendUser);

/**
 * PATCH /api/admin/listings/:id/moderate
 * Sets status to "flagged" or back to "active" — a real review resolution
 * path, not a one-way switch.
 */
router.patch(
  "/listings/:id/moderate",
  moderateListingValidation,
  validate,
  adminController.moderateListing
);

/**
 * GET /api/admin/reports
 * Optionally filtered by status (?status=pending), paginated, newest first.
 */
router.get("/reports", listReportsValidation, validate, adminController.getReports);

/** PATCH /api/admin/reports/:id/resolve */
router.patch("/reports/:id/resolve", resolveReportValidation, validate, adminController.resolveReport);

export default router;
