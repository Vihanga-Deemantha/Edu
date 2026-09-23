import { Router } from "express";
import * as reviewsController from "./reviews.controller.js";
import { createReviewValidation, teacherIdParamValidation, listReviewsValidation } from "./reviews.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * POST /api/reviews
 * Protected — teacherId/reviewerId are derived server-side from
 * linkedRequestId, never trusted from the body (see reviews.service.js).
 */
router.post("/", authenticate, createReviewValidation, validate, reviewsController.createReview);

/**
 * GET /api/reviews/teacher/:teacherId
 * Public, paginated — the trust-mechanism read path for a teacher's profile page.
 */
router.get(
  "/teacher/:teacherId",
  teacherIdParamValidation,
  listReviewsValidation,
  validate,
  reviewsController.getTeacherReviews
);

export default router;
