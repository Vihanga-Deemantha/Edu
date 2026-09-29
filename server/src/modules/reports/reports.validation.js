import { body } from "express-validator";

export const createReportValidation = [
  body("targetType")
    .notEmpty()
    .withMessage("targetType is required")
    .isIn(["review", "listing", "user"])
    .withMessage("targetType must be one of: review, listing, user"),
  body("targetId").notEmpty().withMessage("targetId is required").isMongoId().withMessage("targetId must be a valid id"),
  body("reason")
    .trim()
    .notEmpty()
    .withMessage("reason is required")
    .isLength({ max: 1000 })
    .withMessage("reason must be at most 1000 characters"),
  // Admin-triaged only (see Report.js) — never client-settable at creation.
  body("severity").not().exists().withMessage("severity cannot be set directly"),
];
