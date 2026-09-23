import Conversation from "../models/Conversation.js";
import * as chatService from "../modules/chat/chat.service.js";
import { verifyAccessToken } from "../utils/verifyAccessToken.js";

const conversationRoom = (conversationId) => `conversation:${conversationId}`;

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

  io.on("connection", (socket) => {
    // Registered synchronously, before anything awaits — a client that
    // emits send_message immediately after seeing "connect" (which fires
    // the instant the handshake completes, not after this handler's async
    // work finishes) would otherwise race the listener attachment: Node's
    // EventEmitter silently drops an event with no listener yet, so the
    // message would vanish with no ack ever firing. Found by an
    // intermittent hang in the test suite, not by inspection.
    socket.on("send_message", async ({ conversationId, text } = {}, ack) => {
      try {
        const message = await chatService.createMessage({ conversationId, senderId: socket.user.id, text });
        io.to(conversationRoom(conversationId)).emit("new_message", { conversationId, message });
        ack?.({ success: true, message });
      } catch (err) {
        ack?.({ success: false, error: { message: err.message, code: err.code || "ERROR" } });
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
