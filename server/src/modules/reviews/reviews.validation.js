import { body, param, query } from "express-validator";

export const createReviewValidation = [
  body("linkedRequestId")
    .notEmpty()
    .withMessage("linkedRequestId is required")
    .isMongoId()
    .withMessage("linkedRequestId must be a valid id"),
  body("rating")
    .notEmpty()
    .withMessage("rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("rating must be an integer between 1 and 5"),
  body("comment")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage("comment must be at most 1000 characters"),
];

export const teacherIdParamValidation = [param("teacherId").isMongoId().withMessage("Invalid teacherId")];

export const listReviewsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
