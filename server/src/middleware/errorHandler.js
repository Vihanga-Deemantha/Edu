/**
 * Central Express error-handling middleware.
 * MUST be registered as the last middleware in app.js (4-arg signature).
 *
 * Handles:
 *  - ApiError instances (operational errors we deliberately throw)
 *  - express-validator validation errors (passed as arrays via next())
 *  - Unhandled/unexpected errors (never leak stack in production)
 */
const errorHandler = (err, req, res, next) => {
  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      success: false,
      error: {
        message: `${field.charAt(0).toUpperCase() + field.slice(1)} is already in use`,
        code: "DUPLICATE_FIELD",
      },
    });
  }

  // Operational ApiError
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code || null,
        ...(err.data || {}),
      },
    });
  }

  // Unknown/unexpected error — log it, don't expose internals
  console.error("UNHANDLED ERROR:", err);

  return res.status(500).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      code: "INTERNAL_ERROR",
    },
  });
};

export default errorHandler;
