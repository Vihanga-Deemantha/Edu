import mongoose from "mongoose";

/**
 * InterestRequest — the core marketplace transaction. Runs in either
 * direction depending on the listing type: a student/parent expresses
 * interest in a teacher_ad (fromUserId = student/child, toUserId = teacher),
 * or a teacher expresses interest in a student_ad (fromUserId = teacher,
 * toUserId = student/child). Which side (if either) is child-linked is
 * resolved from User.parentId at request time in interests.service.js, not
 * stored here — a child can be on either side depending on direction.
 */
const interestRequestSchema = new mongoose.Schema(
  {
    listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true, immutable: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "completed"],
      default: "pending",
    },

    message: { type: String, required: true, trim: true, maxlength: 1000 },

    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Enforces "at most one pending request per (listing, sender)" atomically at
// the DB layer — a service-layer check-then-create alone has the same
// TOCTOU race already found and fixed elsewhere this session (refresh-token
// reuse). Partial (status: pending only) so a prior declined/completed
// request never blocks a fresh one for the same pair.
interestRequestSchema.index(
  { listingId: 1, fromUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

interestRequestSchema.index({ fromUserId: 1, createdAt: -1 });
interestRequestSchema.index({ toUserId: 1, createdAt: -1 });

const InterestRequest = mongoose.model("InterestRequest", interestRequestSchema);

export default InterestRequest;
