import { Router } from "express";
import * as verificationController from "./verification.controller.js";
import { submitVerificationValidation } from "./verification.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

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
  validate,
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

/**
 * GET /api/verification/teacher/upload-signature
 * Protected: teacher only.
 * Signed params for a direct-to-Cloudinary upload of a verification document.
 */
router.get(
  "/teacher/upload-signature",
  authenticate,
  authorize("teacher"),
  verificationController.getUploadSignature
);

/**
 * GET /api/verification/document/:userId/:field
 * Protected: the owning teacher or an admin.
 * Returns a short-lived signed URL to view one stored document.
 */
router.get(
  "/document/:userId/:field",
  authenticate,
  verificationController.viewDocument
);

export default router;
