import { body, param, query } from "express-validator";

export const createInterestValidation = [
  body("listingId").notEmpty().withMessage("listingId is required").isMongoId().withMessage("listingId must be a valid id"),
  body("message")
    .trim()
    .notEmpty()
    .withMessage("message is required")
    .isLength({ max: 1000 })
    .withMessage("message must be at most 1000 characters"),
  // Present only for a parent sending interest on behalf of a linked child.
  body("targetUserId").optional().isMongoId().withMessage("targetUserId must be a valid id"),
];

export const respondToInterestValidation = [
  param("id").isMongoId().withMessage("Invalid interest request id"),
  body("status")
    .notEmpty()
    .withMessage("status is required")
    .isIn(["accepted", "declined"])
    .withMessage("status must be 'accepted' or 'declined'"),
];

export const interestIdParamValidation = [param("id").isMongoId().withMessage("Invalid interest request id")];

export const listInterestsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
