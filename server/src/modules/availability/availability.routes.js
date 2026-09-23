import { Router } from "express";
import * as availabilityController from "./availability.controller.js";
import {
  createAvailabilityValidation,
  teacherIdParamValidation,
  availabilityIdParamValidation,
} from "./availability.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

const router = Router();

/** POST /api/availability — teacher declares a recurring weekly window. */
router.post(
  "/",
  authenticate,
  authorize("teacher"),
  createAvailabilityValidation,
  validate,
  availabilityController.createAvailability
);

/**
 * GET /api/availability/:teacherId — public, no auth required (same
 * visibility as a public teacher profile/review read).
 */
router.get(
  "/:teacherId",
  teacherIdParamValidation,
  validate,
  availabilityController.getTeacherAvailability
);

/** DELETE /api/availability/:id — teacher only, own window. */
router.delete(
  "/:id",
  authenticate,
  authorize("teacher"),
  availabilityIdParamValidation,
  validate,
  availabilityController.deleteAvailability
);

export default router;
