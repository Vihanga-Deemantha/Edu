import ApiError from "../utils/ApiError.js";

/**
 * authorize(...allowedRoles) — role-based access control guard.
 * Usage: authorize('admin'), authorize('teacher', 'admin'), etc.
 * Must be used AFTER authenticate middleware so req.user is available.
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, "You do not have permission to perform this action", "FORBIDDEN")
      );
    }
    next();
  };
};

export default authorize;
