import { Router } from "express";
import * as profilesController from "./profiles.controller.js";
import {
  upsertTeacherProfileValidation,
  upsertStudentProfileValidation,
  userIdParamValidation,
  photoUploadSignatureValidation,
  updateMyPhotoValidation,
} from "./profiles.validation.js";
import authenticate from "../../middleware/authenticate.js";
import optionalAuthenticate from "../../middleware/optionalAuthenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

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
  validate,
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
  validate,
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
  validate,
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
  validate,
  profilesController.getStudentProfile
);

/**
 * GET /api/profiles/photo/upload-signature
 * Protected: any role. Signed params for a direct-to-Cloudinary PUBLIC
 * profile-photo upload — ?targetUserId= lets a parent request one scoped to
 * a linked child instead of themselves (service layer enforces the link).
 */
router.get(
  "/photo/upload-signature",
  authenticate,
  photoUploadSignatureValidation,
  validate,
  profilesController.getPhotoUploadSignature
);

/**
 * PUT /api/profiles/me/photo
 * Protected: parent, admin only. Teacher and student set their photo through
 * their existing PUT /teacher and /student upserts instead — see
 * profiles.service.js's updateMyPhoto comment for why.
 */
router.put(
  "/me/photo",
  authenticate,
  authorize("parent", "admin"),
  updateMyPhotoValidation,
  validate,
  profilesController.updateMyPhoto
);

export default router;
