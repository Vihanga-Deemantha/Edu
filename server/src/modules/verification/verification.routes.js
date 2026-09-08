import { Router } from "express";
import * as verificationController from "./verification.controller.js";
import { submitVerificationValidation } from "./verification.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";

const router = Router();

/**
 * POST /api/verification/teacher/submit
 * Protected: teacher only.
 * Submit identity and qualification documents for admin review.
 */
router.post(
  "/teacher/submit",
  authenticate,
  authorize("teacher"),
  submitVerificationValidation,
  verificationController.submitVerification
);

/**
 * GET /api/verification/teacher/me
 * Protected: teacher only.
 * Returns own verification status and tier. NEVER returns adminNotes.
 */
router.get(
  "/teacher/me",
  authenticate,
  authorize("teacher"),
  verificationController.getMyVerification
);

export default router;
