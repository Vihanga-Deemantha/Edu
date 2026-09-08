import { useState, useEffect, useCallback } from "react";
import { authApi } from "../api/authApi.js";
import { setAccessToken, clearAccessToken } from "../api/axiosInstance.js";
import { AuthContext } from "./authContext.js";

/**
 * Status state machine:
 *   loading           — bootstrap refresh in flight (don't redirect)
 *   authenticated     — fully logged in, tokens valid
 *   unauthenticated   — not logged in
 *   otp_pending       — registered / login attempted, waiting for OTP verification
 *   profile_incomplete — Google sign-in succeeded but role/phone still missing
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessTokenState, setAccessTokenState] = useState(null);
  const [status, setStatus] = useState("loading");
  // Stored across OTP flow so VerifyOtpPage knows who it's verifying
  const [pendingUserId, setPendingUserId] = useState(null);

  const storeToken = useCallback((token) => {
    setAccessToken(token);
    setAccessTokenState(token);
  }, []);

  const clearAuth = useCallback(() => {
    clearAccessToken();
    setAccessTokenState(null);
    setUser(null);
    setPendingUserId(null);
    setStatus("unauthenticated");
  }, []);

  // ── Bootstrap: silent refresh on mount ───────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const refreshRes = await authApi.refresh();
        const token = refreshRes.data.data.accessToken;
        storeToken(token);

        const meRes = await authApi.me();
        setUser(meRes.data.data.user);
        setStatus("authenticated");
      } catch {
        clearAuth();
      }
    };
    bootstrap();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth actions ──────────────────────────────────────────────────────────

  /**
   * Register — backend now returns userId + verification status, NO tokens.
   * Sets status to otp_pending so the router redirects to /verify-otp.
   */
  const register = async (payload) => {
    const res = await authApi.register(payload);
    const { userId } = res.data.data;
    setPendingUserId(userId);
    setStatus("otp_pending");
    return res.data.data;
  };

  /**
   * Login — handles ACCOUNT_NOT_VERIFIED (403) by entering otp_pending state.
   */
  const login = async (email, password) => {
    try {
      const res = await authApi.login(email, password);
      const { user: loggedInUser, accessToken } = res.data.data;
      storeToken(accessToken);
      setUser(loggedInUser);
      setStatus("authenticated");
      return loggedInUser;
    } catch (err) {
      // If backend says account not verified, go to OTP flow
      if (err.response?.data?.error?.code === "ACCOUNT_NOT_VERIFIED") {
        // We don't have a userId from the login response, but the user can
        // use resend-otp from the verify page using their email-retrieved userId
        setStatus("otp_pending");
      }
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // clear local state regardless
    } finally {
      clearAuth();
    }
  };

  /**
   * Verify one OTP channel. If both are now verified, backend returns tokens.
   */
  const verifyOtp = async (userId, channel, code) => {
    const res = await authApi.verifyOtp(userId, channel, code);
    const data = res.data.data;

    if (data.fullyVerified) {
      storeToken(data.accessToken);
      setUser(data.user);
      setPendingUserId(null);
      setStatus("authenticated");
    }
    return data;
  };

  const resendOtp = async (userId, channel) => {
    await authApi.resendOtp(userId, channel);
  };

  /**
   * Google Sign-In — backend returns tokens (fully set up) or profile-incomplete.
   */
  const googleLogin = async (idToken) => {
    const res = await authApi.googleAuth(idToken);
    const data = res.data.data;

    if (data.profileIncomplete) {
      setPendingUserId(data.userId);
      setStatus("profile_incomplete");
      return data;
    }

    storeToken(data.accessToken);
    setUser(data.user);
    setStatus("authenticated");
    return data;
  };

  /**
   * Complete profile (Google users) — sets role + phone, triggers phone OTP.
   * After this, user goes to /verify-otp for phone-only verification.
   */
  const completeProfile = async (role, phone) => {
    const res = await authApi.completeProfile(role, phone);
    const data = res.data.data;
    // Now in otp_pending for phone verification
    setStatus("otp_pending");
    return data;
  };

  const registerChild = async (payload) => {
    const res = await authApi.registerChild(payload);
    return res.data.data.child;
  };

  const value = {
    user,
    accessToken: accessTokenState,
    status,
    pendingUserId,
    register,
    login,
    logout,
    verifyOtp,
    resendOtp,
    googleLogin,
    completeProfile,
    registerChild,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
