import { Router } from "express";
import * as bookingsController from "./bookings.controller.js";
import { createBookingValidation, bookingIdParamValidation, listBookingsValidation } from "./bookings.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

router.use(authenticate);

/**
 * POST /api/bookings — either participant of an ACCEPTED interest request
 * can book a trial session, provided the time fits the teacher's declared
 * availability and doesn't conflict with an existing confirmed booking.
 */
router.post("/", createBookingValidation, validate, bookingsController.createBooking);

/**
 * GET /api/bookings/mine — registered before "/:id"-shaped routes below on
 * general principle (Phase 16's price-suggestion route needed this same
 * ordering), though there's no actual collision here since those are PATCH
 * and two segments long.
 */
router.get("/mine", listBookingsValidation, validate, bookingsController.getMyBookings);

/** PATCH /api/bookings/:id/cancel — either participant. */
router.patch("/:id/cancel", bookingIdParamValidation, validate, bookingsController.cancelBooking);

/** PATCH /api/bookings/:id/complete — either participant, confirmed → completed only. */
router.patch("/:id/complete", bookingIdParamValidation, validate, bookingsController.completeBooking);

export default router;
