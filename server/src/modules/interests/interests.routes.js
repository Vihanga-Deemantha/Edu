import { Router } from "express";
import * as interestsController from "./interests.controller.js";
import {
  createInterestValidation,
  respondToInterestValidation,
  interestIdParamValidation,
  listInterestsValidation,
} from "./interests.validation.js";
import authenticate from "../../middleware/authenticate.js";
import authorize from "../../middleware/authorize.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * POST /api/interests
 * Protected: teacher, student, or parent — the service layer enforces which
 * role may act on which listing type (opposite of who owns it) and derives
 * toUserId from listing.ownerId, never a client-supplied value.
 */
router.post(
  "/",
  authenticate,
  authorize("teacher", "student", "parent"),
  createInterestValidation,
  validate,
  interestsController.createInterestRequest
);

/**
 * GET /api/interests/sent
 * Protected — the caller's own sent requests, plus (for a parent) every
 * linked child's.
 */
router.get("/sent", authenticate, listInterestsValidation, validate, interestsController.getSentInterests);

/**
 * GET /api/interests/received
 * Protected — symmetric to /sent above.
 */
router.get(
  "/received",
  authenticate,
  listInterestsValidation,
  validate,
  interestsController.getReceivedInterests
);

/**
 * PATCH /api/interests/:id/respond
 * Protected, toUserId (or parent of a linked-child toUserId) only. Accepting
 * a child-linked request additionally requires the teacher side to be
 * fully_verified — enforced in interests.service.js, not just cosmetically.
 */
router.patch(
  "/:id/respond",
  authenticate,
  respondToInterestValidation,
  validate,
  interestsController.respondToInterestRequest
);

/**
 * PATCH /api/interests/:id/complete
 * Protected, either participant (or a parent acting for a linked-child
 * participant) — only once the request is already accepted.
 */
router.patch(
  "/:id/complete",
  authenticate,
  interestIdParamValidation,
  validate,
  interestsController.completeInterestRequest
);

export default router;
