import { createServer } from "http";
import { Server } from "socket.io";
import { corsOriginCheck } from "./utils/corsOriginCheck.js";
import { attachChatSocket } from "./sockets/chatSocket.js";

/**
 * Wraps the Express app in a raw http.Server and attaches Socket.io to it —
 * Phase 13B's chat needs a real listening server, not just an Express app
 * (supertest can exercise app.js without ever binding a port; a WebSocket
 * client can't). Both server.js (production) and chat's test file build
 * through this one function, so there's exactly one place that wires
 * Express + Socket.io together.
 */
export const createHttpServer = (app) => {
  const httpServer = createServer(app);

  const io = new Server(httpServer, {
    cors: {
      origin: corsOriginCheck,
      credentials: true,
    },
  });

  attachChatSocket(io);

  return { httpServer, io };
};
