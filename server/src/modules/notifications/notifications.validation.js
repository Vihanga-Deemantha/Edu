import { param, query } from "express-validator";

export const listNotificationsValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];

export const notificationIdParamValidation = [param("id").isMongoId().withMessage("Invalid notification id")];
