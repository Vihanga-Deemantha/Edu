import { body, param } from "express-validator";

export const createCheckoutSessionValidation = [
  body("bookingId").isMongoId().withMessage("bookingId must be a valid id"),
];

export const bookingIdParamValidation = [param("bookingId").isMongoId().withMessage("Invalid bookingId")];
