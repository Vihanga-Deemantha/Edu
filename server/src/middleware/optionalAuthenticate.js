import { verifyAccessToken } from "../utils/verifyAccessToken.js";

/**
 * Like authenticate.js, but never rejects the request — attaches req.user
 * when a valid access token is present, leaves it undefined otherwise.
 *
 * For routes a guest can call, but where a logged-in caller legitimately
 * sees more than a stranger does: GET /api/listings/:id is the first case
 * (a teacher_ad is public, a student_ad is teacher-only) — Phase 6B's
 * /browse will need the same thing.
 */
const optionalAuthenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // Invalid/expired token on an optional-auth route — treat as a guest
    // rather than failing a request that doesn't require auth at all.
  }
  next();
};

export default optionalAuthenticate;
