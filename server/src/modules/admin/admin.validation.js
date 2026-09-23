import { body, param, query } from "express-validator";

const adminNotesValidator = () =>
  body("adminNotes")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 2000 })
    .withMessage("adminNotes must be at most 2000 characters");

export const reviewVerificationValidation = [
  param("userId").isMongoId().withMessage("Invalid userId"),
  body("verificationTier")
    .notEmpty()
    .withMessage("verificationTier is required")
    .isIn(["none", "id_verified", "fully_verified"])
    .withMessage("verificationTier must be one of: none, id_verified, fully_verified"),
  body("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(["approved", "rejected"])
    .withMessage("status must be 'approved' or 'rejected'"),
  adminNotesValidator(),
];

export const suspendUserValidation = [param("userId").isMongoId().withMessage("Invalid userId"), adminNotesValidator()];

export const moderateListingValidation = [
  param("id").isMongoId().withMessage("Invalid listing id"),
  body("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(["flagged", "active"])
    .withMessage("status must be 'flagged' or 'active'"),
  adminNotesValidator(),
];

export const listReportsValidation = [
  query("status")
    .optional()
    .isIn(["pending", "resolved", "dismissed"])
    .withMessage("status must be one of: pending, resolved, dismissed"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];

export const resolveReportValidation = [
  param("id").isMongoId().withMessage("Invalid report id"),
  body("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(["resolved", "dismissed"])
    .withMessage("status must be 'resolved' or 'dismissed'"),
  adminNotesValidator(),
];
