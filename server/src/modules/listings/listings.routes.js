import { Router } from "express";
import * as listingsController from "./listings.controller.js";
import {
  createListingValidation,
  updateListingValidation,
  listingIdParamValidation,
  browseListingsValidation,
} from "./listings.validation.js";
import authenticate from "../../middleware/authenticate.js";
import optionalAuthenticate from "../../middleware/optionalAuthenticate.js";
import authorize from "../../middleware/authorize.js";

const router = Router();

/**
 * POST /api/listings
 * Protected: teacher (teacher_ad) or student/parent (student_ad) — the
 * service layer enforces the role must match the requested type and, for a
 * parent, that targetUserId is a linked child.
 */
router.post(
  "/",
  authenticate,
  authorize("teacher", "student", "parent"),
  createListingValidation,
  listingsController.createListing
);

/**
 * GET /api/listings/mine
 * Protected. Must be registered before GET /:id — otherwise Express would
 * try to treat "mine" as an :id value.
 */
router.get("/mine", authenticate, listingsController.getMyListings);

/**
 * GET /api/listings/browse
 * Public, optional auth — a logged-in teacher sees student_ads too; a guest
 * or any other role sees only teacher_ads. Must also be registered before
 * GET /:id for the same reason as /mine above.
 */
router.get(
  "/browse",
  optionalAuthenticate,
  browseListingsValidation,
  listingsController.browseListings
);

/**
 * GET /api/listings/:id
 * Optional auth — a teacher_ad is public; a student_ad needs an
 * authenticated teacher (or the owner/parent/admin) or it 404s.
 */
router.get(
  "/:id",
  optionalAuthenticate,
  listingIdParamValidation,
  listingsController.getListing
);

/**
 * PATCH /api/listings/:id
 * Protected, owner (or parent of a linked-child owner) only.
 */
router.patch(
  "/:id",
  authenticate,
  listingIdParamValidation,
  updateListingValidation,
  listingsController.updateListing
);

/**
 * DELETE /api/listings/:id
 * Protected, owner (or parent of a linked-child owner) only. Soft delete —
 * sets status: "closed", never actually removes the document (later phases
 * reference listings by ID).
 */
router.delete(
  "/:id",
  authenticate,
  listingIdParamValidation,
  listingsController.closeListing
);

export default router;
