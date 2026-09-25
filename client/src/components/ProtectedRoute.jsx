import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";
import { PageLoader } from "./ui/index.jsx";

/**
 * ProtectedRoute — role-aware route guard.
 *
 * Handles partially-authenticated states too.
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <PageLoader />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // If user registered/logged in but needs OTP, send them there
  if (status === "otp_pending") {
    return <Navigate to="/verify-otp" replace />;
  }

  // If user signed in with Google but needs role/phone, send them there
  if (status === "profile_incomplete") {
    return <Navigate to="/complete-profile" replace />;
  }

  // At this point, status is "authenticated"
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
