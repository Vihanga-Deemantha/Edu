import { query } from "express-validator";

export const recommendationsQueryValidation = [
  // Parent-only in practice (resolveStudentTarget ignores it for a student
  // requester) — validated generically here regardless of role, same as
  // every other route in this codebase.
  query("targetUserId").optional().isMongoId().withMessage("targetUserId must be a valid id"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
