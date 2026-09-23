import mongoose from "mongoose";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * TeacherAvailability — a teacher-declared recurring weekly window they can
 * be booked in (e.g. "every Monday, 16:00-18:00"). This is what "teacher-
 * defined availability windows" (Phase 17 roadmap) actually means, distinct
 * from a one-off Booking: bookings.service.js validates every new booking
 * falls entirely within one of these before accepting it.
 *
 * dayOfWeek is 0 (Sunday)-6 (Saturday) and startTime/endTime are plain
 * "HH:mm" 24-hour strings, both compared against a booking's UTC day/time in
 * bookings.service.js — there's no per-user timezone stored anywhere else in
 * this app to convert against, so both sides of every comparison
 * deliberately stay in the same UTC reference frame instead of introducing one.
 */
const teacherAvailabilitySchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: HH_MM },
    endTime: { type: String, required: true, match: HH_MM },
  },
  { timestamps: true }
);

// Defense-in-depth backstop — availability.validation.js already rejects
// endTime <= startTime before this is ever reached, same "express-validator
// is the real gate, the schema is just a backstop" convention every other
// model in this app already follows.
teacherAvailabilitySchema.pre("validate", function () {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    throw new Error("endTime must be after startTime");
  }
});

// Matches bookings.service.js's fitsAvailability query (teacherId + dayOfWeek) exactly.
teacherAvailabilitySchema.index({ teacherId: 1, dayOfWeek: 1 });

const TeacherAvailability = mongoose.model("TeacherAvailability", teacherAvailabilitySchema);

export default TeacherAvailability;
