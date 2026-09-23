import axiosInstance from "./axiosInstance.js";

export const authApi = {
  // ── Registration & login ──────────────────────────────────────────────────
  register: (payload) => axiosInstance.post("/auth/register", payload),

  login: (email, password) =>
    axiosInstance.post("/auth/login", { email, password }),

  logout: () => axiosInstance.post("/auth/logout"),

  refresh: () => axiosInstance.post("/auth/refresh"),

  me: () => axiosInstance.get("/auth/me"),

  // ── OTP ──────────────────────────────────────────────────────────────────
  verifyOtp: (userId, channel, code) =>
    axiosInstance.post("/auth/verify-otp", { userId, channel, code }),

  resendOtp: (userId, channel) =>
    axiosInstance.post("/auth/resend-otp", { userId, channel }),

  // ── Child accounts ────────────────────────────────────────────────────────
  registerChild: (payload) =>
    axiosInstance.post("/auth/register-child", payload),

  // ── Google Sign-In ────────────────────────────────────────────────────────
  googleAuth: (idToken) =>
    axiosInstance.post("/auth/google", { idToken }),

  // ── Complete profile (Google users) ──────────────────────────────────────
  completeProfile: (role, phone) =>
    axiosInstance.patch("/auth/complete-profile", { role, phone }),

  // ── Forgot / reset password ──────────────────────────────────────────────
  forgotPassword: (email) =>
    axiosInstance.post("/auth/forgot-password", { email }),

  resetPassword: (email, code, newPassword) =>
    axiosInstance.post("/auth/reset-password", { email, code, newPassword }),
};
