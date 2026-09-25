import { io } from "socket.io-client";
import axiosInstance, { getAccessToken, setAccessToken } from "../api/axiosInstance.js";

// The socket server shares the API's origin (httpServer.js attaches
// Socket.io to the same HTTP server), so strip the /api path.
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/api\/?$/, "") || undefined;

/**
 * Opens an authenticated chat socket. The handshake carries the same access
 * token REST uses; if it has expired, the token is refreshed once through
 * the normal /auth/refresh cookie flow and the connection retried.
 */
export const connectChatSocket = () => {
  const socket = io(SOCKET_URL, {
    auth: (cb) => cb({ token: getAccessToken() }),
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  let refreshed = false;
  socket.on("connect_error", async (err) => {
    if (refreshed || !/token/i.test(err.message)) return;
    refreshed = true;
    try {
      const { data } = await axiosInstance.post("/auth/refresh");
      setAccessToken(data.data.accessToken);
      socket.connect();
    } catch {
      // Refresh failed — the REST interceptor will route to /login on the next call.
    }
  });
  socket.on("connect", () => {
    refreshed = false;
  });

  return socket;
};

/** Emits send_message and resolves with the server's ack ({ success, message | error }). */
export const sendChatMessage = (socket, conversationId, text, timeoutMs = 10000) =>
  new Promise((resolve) => {
    socket.timeout(timeoutMs).emit("send_message", { conversationId, text }, (err, ack) => {
      if (err) resolve({ success: false, error: { message: "The server didn't respond. Check your connection." } });
      else resolve(ack);
    });
  });
