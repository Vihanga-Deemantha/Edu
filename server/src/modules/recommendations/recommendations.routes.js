import { Router } from "express";
import * as recommendationsController from "./recommendations.controller.js";
import { recommendationsQueryValidation } from "./recommendations.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * GET /api/recommendations/teachers
 * Protected: student (own) or parent (a linked child, via ?targetUserId=).
 * Phase 8 — weighted content-based scoring, no learned model; see
 * recommendations.service.js.
 */
router.get(
  "/teachers",
  authenticate,
  authorize("student", "parent"),
  recommendationsQueryValidation,
  validate,
  recommendationsController.recommendTeachers
);

/**
 * GET /api/recommendations/students
 * Protected: teacher only — the symmetric "leads" view: student wanted-ads
 * that fit this teacher's own subjects/grades/medium/location.
 */
router.get(
  "/students",
  authenticate,
  authorize("teacher"),
  recommendationsQueryValidation,
  validate,
  recommendationsController.recommendStudents
);

export default router;
