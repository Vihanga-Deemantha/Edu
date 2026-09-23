import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import verificationRoutes from "./modules/verification/verification.routes.js";
import profileRoutes from "./modules/profiles/profiles.routes.js";
import listingRoutes from "./modules/listings/listings.routes.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS — locked to a known set of frontend origins, with credentials for cookies.
//    CORS_ORIGIN accepts a comma-separated list (e.g. local dev + staging +
//    prod) — a single value still works unchanged since split(",") on a
//    string with no comma just returns a one-element array.
//    Using a function for `origin` defers the env-var read to request time,
//    avoiding the ESM import-hoisting problem where static imports run before
//    dotenv.config() populates process.env.
app.use(
  cors({
    origin: (requestOrigin, callback) => {
      const allowedOrigins = (process.env.CORS_ORIGIN || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${requestOrigin}' not allowed`));
      }
    },
    credentials: true, // allows cookies to be sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 3. Body parsing
app.use(express.json());

// 4. Cookie parsing (needed to read the httpOnly refresh token cookie)
app.use(cookieParser());

// 5. Route mounting
app.use("/api/auth", authRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/listings", listingRoutes);

// 6. 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: "Route not found", code: "NOT_FOUND" },
  });
});

// 7. Centralized error handler — MUST be last
app.use(errorHandler);

export default app;
