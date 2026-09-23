import mongoose from "mongoose";

/**
 * AuditLog — one document per admin action, written by admin.service.js and
 * awaited (not fire-and-forget, unlike Event/Notification) since its whole
 * purpose is being a reliable record to reconstruct a disputed moderation
 * decision from — a silently-dropped write would defeat that.
 *
 * No read endpoint yet — Phase 15's admin dashboard is the natural
 * consumer, same "infrastructure ahead of its consumer" shape as
 * Event/Notification/Report before their respective phases existed.
 */
const auditLogSchema = new mongoose.Schema(
  {
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: ["verification", "user", "listing", "report"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Free-form context beyond "what kind of thing, which one" — e.g. the
    // tier a verification was set to, or the status a report was resolved
    // with. Without this the log can say an action happened but not what it
    // actually did, which defeats the "reconstruct a disputed decision"
    // purpose stated above.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
