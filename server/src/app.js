import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./modules/auth/auth.routes.js";
import verificationRoutes from "./modules/verification/verification.routes.js";
import profileRoutes from "./modules/profiles/profiles.routes.js";
import listingRoutes from "./modules/listings/listings.routes.js";
import recommendationRoutes from "./modules/recommendations/recommendations.routes.js";
import notificationRoutes from "./modules/notifications/notifications.routes.js";
import interestRoutes from "./modules/interests/interests.routes.js";
import reviewRoutes from "./modules/reviews/reviews.routes.js";
import reportRoutes from "./modules/reports/reports.routes.js";
import chatRoutes from "./modules/chat/chat.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import searchRoutes from "./modules/search/search.routes.js";
import availabilityRoutes from "./modules/availability/availability.routes.js";
import bookingRoutes from "./modules/bookings/bookings.routes.js";
import paymentRoutes from "./modules/payments/payments.routes.js";
import * as paymentsController from "./modules/payments/payments.controller.js";
import errorHandler from "./middleware/errorHandler.js";
import { corsOriginCheck } from "./utils/corsOriginCheck.js";

const app = express();

// 1. Security headers
app.use(helmet());

// 2. CORS — locked to a known set of frontend origins, with credentials for cookies.
app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true, // allows cookies to be sent cross-origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2.5. Stripe webhook — MUST be registered before express.json() below.
// Signature verification (payments.controller.js's handleWebhook) needs the
// exact raw bytes Stripe signed; once express.json() parses the body, that
// exact byte sequence is gone and verification can never succeed. Every
// other /api/payments/* route goes through the normal JSON router mounted
// in step 5, below express.json().
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), paymentsController.handleWebhook);

// 3. Body parsing
app.use(express.json());

// 4. Cookie parsing (needed to read the httpOnly refresh token cookie)
app.use(cookieParser());

// 5. Route mounting
app.use("/api/auth", authRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/interests", interestRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

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
