import { Router } from "express";
import * as paymentsController from "./payments.controller.js";
import { createCheckoutSessionValidation, bookingIdParamValidation } from "./payments.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

// The webhook route is NOT registered here — it's mounted directly in
// app.js, ahead of express.json(), since it needs raw-body signature
// verification instead of authenticate + JSON parsing. Every route in this
// router assumes both.
router.use(authenticate);

/** POST /api/payments/checkout — student side of a confirmed booking. */
router.post("/checkout", createCheckoutSessionValidation, validate, paymentsController.createCheckoutSession);

/** GET /api/payments/booking/:bookingId — either side of the booking. */
router.get("/booking/:bookingId", bookingIdParamValidation, validate, paymentsController.getBookingPaymentStatus);

export default router;
