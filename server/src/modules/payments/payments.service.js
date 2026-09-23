import { getStripeClient } from "../../config/stripe.js";
import Booking from "../../models/Booking.js";
import Payment from "../../models/Payment.js";
import ApiError from "../../utils/ApiError.js";
import { resolveBookingSide } from "../bookings/bookings.service.js";

const DEPOSIT_CURRENCY = "usd";

/**
 * POST /api/payments/checkout. Only the student side of a CONFIRMED booking
 * can start a deposit checkout — a teacher never pays this. The amount is a
 * fixed platform fee (TRIAL_DEPOSIT_AMOUNT_CENTS), not derived from the
 * listing's own LKR price: Stripe doesn't support Sri Lanka as an account
 * country, so this is deliberately a flat USD reservation fee, not a
 * currency conversion of the lesson's real price.
 */
export const createCheckoutSession = async ({ bookingId, requesterId, requesterRole }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }
  const side = await resolveBookingSide(requesterId, requesterRole, booking);
  if (side !== "student") {
    throw new ApiError(403, "Only the student side of a booking can pay its trial deposit.", "FORBIDDEN");
  }
  if (booking.status !== "confirmed") {
    throw new ApiError(400, "Only a confirmed booking can be paid for.", "INVALID_STATE");
  }
  if (await Payment.findOne({ bookingId, status: "paid" })) {
    throw new ApiError(409, "This booking's trial deposit has already been paid.", "ALREADY_PAID");
  }

  const amount = parseInt(process.env.TRIAL_DEPOSIT_AMOUNT_CENTS, 10) || 1000;
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: DEPOSIT_CURRENCY,
          product_data: { name: "EduHub trial class deposit" },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.CLIENT_URL}/bookings/${bookingId}?payment=success`,
    cancel_url: `${process.env.CLIENT_URL}/bookings/${bookingId}?payment=cancelled`,
    metadata: { bookingId: String(bookingId) },
  });

  await Payment.create({
    bookingId,
    payerId: requesterId,
    amount,
    currency: DEPOSIT_CURRENCY,
    stripeSessionId: session.id,
  });

  return { checkoutUrl: session.url };
};

/** GET /api/payments/booking/:bookingId — either side of the booking (the teacher may want to confirm the deposit landed before running the trial). */
export const getBookingPaymentStatus = async ({ bookingId, requesterId, requesterRole }) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found", "BOOKING_NOT_FOUND");
  }
  if (!(await resolveBookingSide(requesterId, requesterRole, booking))) {
    throw new ApiError(403, "You do not have permission to view this booking's payment status.", "FORBIDDEN");
  }
  return Payment.findOne({ bookingId }).sort({ createdAt: -1 });
};

/**
 * Called only from payments.controller.js's handleWebhook, after Stripe's
 * signature has already been verified — this function trusts its input.
 * findOneAndUpdate (not find-then-save) so a Stripe retry of the same event
 * (its own documented at-least-once delivery guarantee) is naturally
 * idempotent: re-applying the same {status: "paid"} update twice is a no-op,
 * not a double-charge or a duplicate side effect.
 */
export const handleWebhookEvent = async (event) => {
  if (event.type !== "checkout.session.completed") return;
  const session = event.data.object;
  await Payment.findOneAndUpdate({ stripeSessionId: session.id }, { status: "paid", paidAt: new Date() });
};
