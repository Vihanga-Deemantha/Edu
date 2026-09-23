import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../.env") });

import connectDB from "./config/db.js";
import app from "./app.js";
import { createHttpServer } from "./httpServer.js";
import { warmUpEmbeddingModel } from "./services/embedding.service.js";

const PORT = process.env.PORT || 5000;

const start = async () => {
  // Connect to DB first — fail fast if DB is unreachable
  await connectDB();

  // Loads Phase 16's embedding model once, up front, instead of on
  // whichever request happens to hit it first — that first load takes real
  // time (reading/decoding the ONNX weights), and nobody should have to be
  // the unlucky request that pays for it.
  warmUpEmbeddingModel().catch((err) => console.error("Embedding model warm-up failed (non-fatal):", err.message));

  // Only start accepting requests after DB is connected. Listening on the
  // wrapping httpServer (not app.listen directly) so Socket.io's chat
  // connections share the same port as the REST API.
  const { httpServer } = createHttpServer(app);
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
};

start();
