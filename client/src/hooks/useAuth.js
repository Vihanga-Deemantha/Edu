import { useContext } from "react";
import { AuthContext } from "../context/authContext.js";

/**
 * Convenience hook to consume AuthContext.
 * Throws if used outside <AuthProvider> — catches wiring mistakes early.
 */
const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
};

export default useAuth;
