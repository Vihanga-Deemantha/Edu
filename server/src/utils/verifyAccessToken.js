import jwt from "jsonwebtoken";

/**
 * Decodes and verifies an access token, returning { id, role } — throws
 * (jsonwebtoken's own error, e.g. TokenExpiredError) on an invalid/expired
 * token; a caller that needs to distinguish why it failed (see
 * authenticate.js) inspects err.name itself. The one place that knows the
 * token's { sub, role } claim shape maps onto req.user (HTTP) or socket.user
 * (Phase 13B's chat socket) — extracted once a third call site (the socket
 * auth middleware) was about to copy-paste it again.
 */
export const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  return { id: decoded.sub, role: decoded.role };
};
