import Conversation from "../models/Conversation.js";
import * as chatService from "../modules/chat/chat.service.js";
import { verifyAccessToken } from "../utils/verifyAccessToken.js";
import { userEvents, USER_SUSPENDED } from "../events/userEvents.js";

const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;

/**
 * Socket.io connection middleware — the same access token used for REST
 * (Authorization: Bearer ...), sent instead via the handshake's `auth`
 * payload, since that's the transport-agnostic, officially-recommended
 * place for it (works identically over both the websocket and long-polling
 * transports, unlike a custom header).
 */
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("No token provided"));
  }
  try {
    socket.user = verifyAccessToken(token);
    next();
  } catch {
    next(new Error("Invalid or expired token"));
  }
};

/**
 * Wires Phase 13B's chat events onto an existing Socket.io server (built in
 * httpServer.js). Auto-joins every one of the connecting user's
 * conversation rooms on connect, rather than requiring an explicit
 * per-conversation join event — simple and correct for this phase's scope.
 * A conversation created later in the same session (interest accepted
 * while this socket is already connected) needs a reconnect to pick up;
 * Phase 13F's frontend can trigger one off its own "interest accepted"
 * notification if that gap ever matters in practice.
 *
 * Room membership is purely a broadcast-routing convenience, never the
 * access-control check — send_message re-verifies participancy against
 * the database on every message (via chatService.createMessage), the same
 * source of truth the REST history endpoint uses.
 */
export const attachChatSocket = (io) => {
  io.use(authenticateSocket);

  // Registered once, at server-attach time, not per-connection. authenticateSocket
  // (and REST's own authenticate middleware) only check a user's token/isActive
  // at the moment a connection or request starts — a REST request re-runs
  // that check every time, but a socket's handshake happens once and the
  // connection is then long-lived, so it's never re-verified again on its
  // own. Before this, an admin suspending a user (admin.service.js's
  // suspendUser — deliberately built to mean "immediate session
  // revocation," and it does correctly delete their RefreshTokens) left any
  // already-open chat socket completely unaffected: it would keep sending
  // and receiving messages until the client happened to disconnect on its
  // own, well past even the 15-minute access-token TTL that bounds the
  // equivalent REST-side exposure. `userRoom` below is what makes "every
  // live socket belonging to this specific user" a single addressable
  // target instead of needing to scan every connected socket.
  userEvents.on(USER_SUSPENDED, (userId) => {
    io.in(userRoom(userId)).disconnectSockets(true);
  });

  io.on("connection", (socket) => {
    // Synchronous, alongside the send_message listener below — the same
    // "register before anything awaits" reasoning applies: a suspension
    // landing in the gap between connection and the async auto-join below
    // must not find this socket unlisted in its own user room.
    socket.join(userRoom(socket.user.id));

    // Registered synchronously, before anything awaits — a client that
    // emits send_message immediately after seeing "connect" (which fires
    // the instant the handshake completes, not after this handler's async
    // work finishes) would otherwise race the listener attachment: Node's
    // EventEmitter silently drops an event with no listener yet, so the
    // message would vanish with no ack ever firing. Found by an
    // intermittent hang in the test suite, not by inspection.
    socket.on("send_message", async (payload, ack) => {
      try {
        // Destructured here, inside the try, not in the parameter list — a
        // `{} = {}` default only covers `undefined`, not `null`, and a
        // client is free to `emit("send_message", null, cb)` (an ordinary,
        // one-line call on the standard socket.io-client, no malicious
        // crafting needed). Destructuring `null` in a parameter list throws
        // during argument binding, before this function's own body — every
        // line of it, including this try/catch — ever runs; for an async
        // function that becomes a promise rejection nothing here ever
        // catches, which crashes the whole process, not just this socket.
        // `payload || {}` folds null and undefined into the same safe case.
        const { conversationId, text } = payload || {};
        const message = await chatService.createMessage({ conversationId, senderId: socket.user.id, text });
        io.to(conversationRoom(conversationId)).emit("new_message", { conversationId, message });
        ack?.({ success: true, message });
      } catch (err) {
        // Same operational-vs-not distinction as middleware/errorHandler.js:
        // an ApiError's message is a deliberate, safe, user-facing string
        // (e.g. "Conversation not found") and is fine to echo as-is; an
        // unexpected error (e.g. a raw Mongoose CastError from a malformed
        // conversationId) previously leaked its internal message straight to
        // the client in every environment, since — unlike the REST handler
        // — nothing here gated on NODE_ENV. It also never reached
        // console.error, so an unexpected chat failure was visible to the
        // client but invisible to anyone operating this server.
        if (!err.isOperational) console.error("Unexpected error in send_message:", err);
        const message = err.isOperational
          ? err.message
          : process.env.NODE_ENV === "production"
            ? "Something went wrong sending your message."
            : err.message;
        ack?.({ success: false, error: { message, code: err.code || "ERROR" } });
      }
    });

    // Safe to do after registering the listener above — this only affects
    // which rooms exist to broadcast new_message into, not the sender's own
    // ack. Emits "ready" once done so a caller that needs the auto-join to
    // have actually completed (e.g. a test sending from a second socket
    // right away) has a real signal to wait for instead of guessing at timing.
    Conversation.find({ participantIds: socket.user.id })
      .select("_id")
      .then((conversations) => {
        for (const conversation of conversations) {
          socket.join(conversationRoom(conversation._id));
        }
        socket.emit("ready");
      })
      .catch((err) => {
        console.error("Failed to auto-join conversation rooms:", err.message);
        socket.emit("ready"); // send_message's own DB-backed check is the real guard either way
      });
  });
};
