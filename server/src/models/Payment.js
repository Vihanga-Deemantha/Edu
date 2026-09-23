import mongoose from "mongoose";

/**
 * Payment — a Stripe Checkout Session for one Booking's trial-class deposit.
 * One booking can end up with more than one row here if an earlier checkout
 * attempt was abandoned (Stripe sessions expire unused; a fresh one is just
 * created rather than trying to resume an expired one) — only a "paid" row
 * ever matters, so nothing reads/writes this collection assuming uniqueness
 * per bookingId.
 */
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, immutable: true },
    payerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    amount: { type: Number, required: true, immutable: true }, // smallest currency unit (cents)
    currency: { type: String, required: true, immutable: true },
    stripeSessionId: { type: String, required: true, unique: true, immutable: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

paymentSchema.index({ bookingId: 1, status: 1 });

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
