import mongoose from "mongoose";

/**
 * Report — generic flag/report record, deliberately not scoped to reviews
 * only (targetType covers review|listing|user) since Phase 14's admin
 * moderation queue (GET /api/admin/reports, PATCH .../resolve) reads from
 * this same collection regardless of what's being reported. This phase only
 * writes to it (POST /api/reports) — nothing reads it back yet, same
 * "infrastructure ahead of its consumer" shape as Phase 9's Notification
 * model before Phase 10B existed.
 */
const reportSchema = new mongoose.Schema(
  {
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["review", "listing", "user"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Matches Phase 14's moderation-queue read pattern: pending reports first.
reportSchema.index({ status: 1, createdAt: -1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;
