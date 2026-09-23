import { param, query } from "express-validator";

export const conversationIdParamValidation = [param("id").isMongoId().withMessage("Invalid conversation id")];

export const listMessagesValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
