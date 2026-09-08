import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";

/**
 * authenticate — verifies the JWT access token from the Authorization header.
 * On success, attaches req.user = { id, role } for downstream middleware/controllers.
 * On failure (missing/expired/tampered), throws 401.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new ApiError(401, "No token provided", "NO_TOKEN"));
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: decoded.sub, role: decoded.role };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new ApiError(401, "Token expired", "TOKEN_EXPIRED"));
    }
    return next(new ApiError(401, "Invalid token", "INVALID_TOKEN"));
  }
};

export default authenticate;
