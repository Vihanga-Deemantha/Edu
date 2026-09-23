import mongoose from "mongoose";

/**
 * Review — always written server-side off a completed InterestRequest,
 * never directly from client-supplied teacherId/reviewerId (see
 * reviews.service.js's use of interests.service.js's resolveInterestSides).
 * One review per linkedRequestId, enforced at the DB layer (unique) so a
 * completed engagement can't be reviewed twice to inflate/deflate a
 * teacher's avgRating.
 */
const reviewSchema = new mongoose.Schema(
  {
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
    linkedRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterestRequest",
      required: true,
      unique: true,
      immutable: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reviewSchema.index({ teacherId: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
