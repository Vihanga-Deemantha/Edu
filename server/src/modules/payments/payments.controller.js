import { getStripeClient } from "../../config/stripe.js";
import * as paymentsService from "./payments.service.js";
import ApiError from "../../utils/ApiError.js";

// ─── POST /api/payments/checkout  (protected, student side of the booking) ──
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { checkoutUrl } = await paymentsService.createCheckoutSession({
      bookingId: req.body.bookingId,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(201).json({ success: true, data: { checkoutUrl } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/payments/booking/:bookingId  (protected, either booking side) ─
export const getBookingPaymentStatus = async (req, res, next) => {
  try {
    const payment = await paymentsService.getBookingPaymentStatus({
      bookingId: req.params.bookingId,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });
    res.status(200).json({ success: true, data: { payment } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/payments/webhook — called by Stripe's servers, not a browser
 * client. Mounted directly in app.js with express.raw() BEFORE the global
 * express.json(), since constructEvent needs the exact raw bytes Stripe
 * signed — a parsed-then-stringified copy would not byte-for-byte match,
 * and verification would always fail. That verification (an HMAC over the
 * raw body against STRIPE_WEBHOOK_SECRET) IS this route's authentication —
 * there's no `authenticate` middleware here on purpose, and there
 * deliberately isn't a validate/express-validator chain either, since
 * there's nothing meaningful to validate on a Buffer before the signature
 * itself is checked.
 */
export const handleWebhook = async (req, res, next) => {
  const stripe = getStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return next(new ApiError(400, `Webhook signature verification failed: ${err.message}`, "INVALID_WEBHOOK_SIGNATURE"));
  }

  try {
    await paymentsService.handleWebhookEvent(event);
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
};
