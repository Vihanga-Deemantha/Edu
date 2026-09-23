import Event from "../models/Event.js";

const VALID_ACTIONS = [
  "view_listing",
  "view_profile",
  "search",
  "filter_apply",
  "interest_sent",
  "interest_accepted",
];

/**
 * Fire-and-forget event write. Callers never `await` this in a request
 * handler — a logging failure must never break the request it's attached
 * to, and the write shouldn't add latency to the response. The returned
 * promise never rejects (errors are caught and logged here); it exists
 * only so tests can `await` it directly when they want to assert on the
 * write without racing the HTTP response.
 */
export const logEvent = ({
  userId = null,
  sessionId = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
}) => {
  if (!VALID_ACTIONS.includes(action)) {
    console.error(`Event logging skipped — unknown action "${action}"`);
    return Promise.resolve(null);
  }

  return Event.create({ userId, sessionId, action, targetType, targetId, metadata }).catch((err) => {
    console.error("Event logging failed (non-fatal):", err.message);
    return null;
  });
};

/**
 * Convenience wrapper for controllers — pulls userId (if authenticated) and
 * sessionId (from the X-Session-Id header) off an Express request, so call
 * sites don't repeat that extraction. Same fire-and-forget contract as
 * logEvent: call it, don't await it, in a request handler.
 */
export const logEventFromRequest = (req, { action, targetType, targetId, metadata }) =>
  logEvent({
    userId: req.user?.id || null,
    sessionId: req.headers["x-session-id"] || null,
    action,
    targetType,
    targetId,
    metadata,
  });
