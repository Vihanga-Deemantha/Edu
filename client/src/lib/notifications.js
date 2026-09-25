// Mirrors server/src/services/notification.service.js's message templates so
// the in-app list reads the same as the email that went out.
const MESSAGES = {
  interest_received: (p) => `${p?.fromName || "Someone"} sent you an interest request${p?.subject ? ` for ${p.subject}` : ""}`,
  interest_accepted: (p) => `Your interest request${p?.subject ? ` for ${p.subject}` : ""} was accepted`,
  interest_declined: (p) => `Your interest request${p?.subject ? ` for ${p.subject}` : ""} was declined`,
  interest_completed: (p) => `Your interest request${p?.subject ? ` for ${p.subject}` : ""} was marked completed`,
  new_review: (p) => `You received a new ${p?.rating ? `${p.rating}-star ` : ""}review`,
  listing_flagged: (p) => `Your listing${p?.subject ? ` “${p.subject}”` : ""} was flagged for review`,
};

export const notificationText = (n) => MESSAGES[n.type]?.(n.payload) || "You have a new notification";

export const NOTIFICATION_ICON = {
  interest_received: "users",
  interest_accepted: "check",
  interest_declined: "x",
  interest_completed: "book",
  new_review: "heart",
  listing_flagged: "flag",
};

/** Where clicking a notification should take the user. */
export const notificationLink = (n, user) => {
  switch (n.type) {
    case "interest_received":
      return "/interests?tab=received";
    case "interest_accepted":
    case "interest_declined":
    case "interest_completed":
      return "/interests?tab=sent";
    case "new_review":
      return user?._id ? `/teachers/${user._id}` : "/dashboard";
    case "listing_flagged":
      return "/listings/mine";
    default:
      return "/notifications";
  }
};
