import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "interest_received",
  "interest_accepted",
  "interest_declined",
  "interest_completed",
  "new_review",
  "listing_flagged",
];

/**
 * Notification — the in-app record a Phase 9 worker job produces alongside
 * (best-effort) an email. Written only by processNotificationJob
 * (services/notification.service.js); never created directly off a client
 * request — there's no POST route for this collection.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Matches the "paginated, unread-first, newest first" query in
// notifications.service.js exactly.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
