import { Router } from "express";
import * as profilesController from "./profiles.controller.js";
import {
  upsertTeacherProfileValidation,
  upsertStudentProfileValidation,
  userIdParamValidation,
} from "./profiles.validation.js";
import authenticate from "../../middleware/authenticate.js";
import optionalAuthenticate from "../../middleware/optionalAuthenticate.js";
import authorize from "../../middleware/authorize.js";

const router = Router();

/**
 * PUT /api/profiles/teacher
 * Protected: teacher only. Upsert — creates on first call, updates after.
 */
router.put(
  "/teacher",
  authenticate,
  authorize("teacher"),
  upsertTeacherProfileValidation,
  profilesController.upsertTeacherProfile
);

/**
 * GET /api/profiles/teacher/:userId
 * Public — anyone can call this with no token. optionalAuthenticate (not
 * authenticate) so a logged-in viewer is still attributed in the view_profile
 * event Phase 7 logs here, instead of every view looking like a guest's.
 */
router.get(
  "/teacher/:userId",
  optionalAuthenticate,
  userIdParamValidation,
  profilesController.getTeacherProfile
);

/**
 * PUT /api/profiles/student
 * Protected: student (own profile) or parent (a linked child's).
 * targetUserId is always required in the body, even for a self-update.
 */
router.put(
  "/student",
  authenticate,
  authorize("student", "parent"),
  upsertStudentProfileValidation,
  profilesController.upsertStudentProfile
);

/**
 * GET /api/profiles/student/:userId
 * Protected, never public. Teachers may view any; a student only their own;
 * a parent only a linked child's — enforced in profiles.service.js.
 */
router.get(
  "/student/:userId",
  authenticate,
  authorize("teacher", "student", "parent"),
  userIdParamValidation,
  profilesController.getStudentProfile
);

export default router;
