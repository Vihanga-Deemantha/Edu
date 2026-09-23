import mongoose from "mongoose";

/**
 * Booking — a scheduled trial session between the two sides of an ACCEPTED
 * InterestRequest. teacherId/studentId mirror Review's teacherId/reviewerId
 * convention: the participant's own User._id, which may be a child's (see
 * interests.service.js's resolveInterestSides) — never the parent
 * account-holder id Chat's participantIds uses, a different concern.
 */
const bookingSchema = new mongoose.Schema(
  {
    interestRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterestRequest",
      required: true,
      immutable: true,
    },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    startTime: { type: Date, required: true, immutable: true },
    endTime: { type: Date, required: true, immutable: true },
    status: { type: String, enum: ["confirmed", "cancelled", "completed"], default: "confirmed" },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { timestamps: true }
);

// bookings.service.js's conflict check filters by teacherId + status first,
// then range-compares startTime/endTime — this is the index that query uses.
bookingSchema.index({ teacherId: 1, status: 1, startTime: 1 });
bookingSchema.index({ interestRequestId: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
