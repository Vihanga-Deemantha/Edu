import { body, param, query } from "express-validator";

export const createBookingValidation = [
  body("interestRequestId").isMongoId().withMessage("interestRequestId must be a valid id"),
  body("startTime").isISO8601().withMessage("startTime must be a valid ISO 8601 date"),
  body("durationMinutes")
    .isInt({ min: 15, max: 240 })
    .withMessage("durationMinutes must be an integer between 15 and 240 (minutes)"),
  body("notes")
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage("notes must be at most 500 characters"),
];

export const bookingIdParamValidation = [param("id").isMongoId().withMessage("Invalid booking id")];

export const listBookingsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
