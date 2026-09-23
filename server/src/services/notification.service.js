import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendEmail } from "./email.service.js";

/**
 * The business logic a notification job runs — deliberately separated from
 * queues/notification.worker.js's BullMQ wiring so it's a plain, directly
 * testable async function (no Redis needed to test it) and so the worker
 * file itself stays thin.
 */

const NOTIFICATION_SUBJECTS = {
  interest_received: "You've received a new interest request",
  interest_accepted: "Your interest request was accepted",
  interest_declined: "Your interest request was declined",
  interest_completed: "An interest request was marked completed",
  new_review: "You've received a new review",
  listing_flagged: "Your listing was flagged for review",
};

// Payload fields are read defensively (optional chaining, no required
// shape) since the modules that will actually enqueue these jobs
// (Phase 10B, Phase 11B) don't exist yet — this only commits to "whatever
// payload is given renders something reasonable," not a fixed contract a
// not-yet-built caller could get wrong.
const NOTIFICATION_MESSAGES = {
  interest_received: (payload) =>
    `${payload?.fromName || "Someone"} sent you an interest request${payload?.subject ? ` for ${payload.subject}` : ""}.`,
  interest_accepted: (payload) =>
    `Your interest request${payload?.subject ? ` for ${payload.subject}` : ""} was accepted.`,
  interest_declined: (payload) =>
    `Your interest request${payload?.subject ? ` for ${payload.subject}` : ""} was declined.`,
  interest_completed: (payload) =>
    `Your interest request${payload?.subject ? ` for ${payload.subject}` : ""} was marked completed.`,
  new_review: (payload) => `You received a new ${payload?.rating ? `${payload.rating}-star ` : ""}review.`,
  listing_flagged: (payload) => `Your listing${payload?.subject ? ` "${payload.subject}"` : ""} was flagged for review.`,
};

/**
 * Runs for every queued notification job: writes the in-app Notification
 * document, then best-effort emails the target user. Email failure is
 * logged, not thrown — the in-app record (what GET /api/notifications
 * actually serves) is the primary side effect and must survive an SMTP
 * hiccup, same fire-and-forget tolerance Phase 7's event logging already
 * established for a non-critical side channel.
 *
 * The Notification document is always stored under the given userId as-is
 * (a child's account, for a child-linked interest) — notifications.service.js
 * aggregates a parent's own + linked children's notifications at read time,
 * the same "resolve at read time" pattern already used for listings/
 * interests. The EMAIL, though, can't wait for a read — a child's stored
 * email is a random, unreachable placeholder (Phase 0's registerChild), so
 * it's redirected to the parent's real address here.
 */
export const processNotificationJob = async ({ userId, type, payload = {} }) => {
  const notification = await Notification.create({ userId, type, payload });

  const targetUser = await User.findById(userId);
  const emailRecipient = targetUser?.parentId ? await User.findById(targetUser.parentId) : targetUser;

  if (emailRecipient) {
    try {
      await sendEmail({
        to: emailRecipient.email,
        subject: NOTIFICATION_SUBJECTS[type] || "You have a new notification",
        html: `<p>${NOTIFICATION_MESSAGES[type]?.(payload) || "You have a new notification on EduHub."}</p>`,
      });
    } catch (err) {
      console.error("Notification email failed (non-fatal):", err.message);
    }
  }

  return notification;
};
