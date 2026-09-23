import { validationResult } from "express-validator";
import * as authService from "./auth.service.js";
import { setRefreshTokenCookie, clearRefreshTokenCookie } from "../../utils/generateTokens.js";
import ApiError from "../../utils/ApiError.js";

/**
 * Helper: check express-validator results and throw formatted 422 if invalid.
 */
const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
    err.details = errors.array();
    throw err;
  }
};

// ─── POST /api/auth/register ─────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    validate(req);
    const { name, email, phone, password, role } = req.body;
    const { user } = await authService.registerUser({ name, email, phone, password, role });

    // No tokens issued yet — user must verify email AND phone first
    res.status(201).json({
      success: true,
      data: {
        userId: user._id,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        message: "Account created. Verification codes have been sent to your email and phone. Please verify both to complete sign-up.",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/verify-otp ───────────────────────────────────────────────
export const verifyOtp = async (req, res, next) => {
  try {
    validate(req);
    const { userId, channel, code } = req.body;
    // purpose is always 'signup' for this flow
    const result = await authService.verifyOtpAndMaybeLogin({
      userId,
      channel,
      purpose: "signup",
      code,
      userAgent: req.headers["user-agent"],
    });

    if (result.fullyVerified) {
      setRefreshTokenCookie(res, result.refreshToken);
      return res.status(200).json({
        success: true,
        data: {
          message: "Both channels verified. You are now logged in.",
          fullyVerified: true,
          user: authService.publicUser(result.user),
          accessToken: result.accessToken,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: `${channel === "email" ? "Email" : "Phone"} verified. Please also verify your ${channel === "email" ? "phone" : "email"}.`,
        fullyVerified: false,
        emailVerified: result.user.emailVerified,
        phoneVerified: result.user.phoneVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/resend-otp ───────────────────────────────────────────────
export const resendOtp = async (req, res, next) => {
  try {
    validate(req);
    const { userId, channel } = req.body;
    await authService.resendOtp({ userId, channel, purpose: "signup" });

    res.status(200).json({
      success: true,
      data: {
        message: `Verification code resent to your ${channel === "email" ? "email" : "phone"}.`,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/login ────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    validate(req);
    const { email, password } = req.body;
    const { user, accessToken, refreshToken } = await authService.loginUser({
      email,
      password,
      userAgent: req.headers["user-agent"],
    });

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: authService.publicUser(user),
        accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/refresh ──────────────────────────────────────────────────
export const refresh = async (req, res, next) => {
  try {
    const rawRefreshToken = req.cookies?.refreshToken;
    const { accessToken, refreshToken } = await authService.refreshTokens(
      rawRefreshToken,
      req.headers["user-agent"]
    );

    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/logout  (protected) ─────────────────────────────────────
// Ends ONLY the current session (this device's refresh token) — other
// devices the user is logged in on are untouched. authenticate still guards
// the route so a bare cookie without a valid access token can't be used to
// log out an arbitrary session.
export const logout = async (req, res, next) => {
  try {
    await authService.logoutUser(req.cookies?.refreshToken);
    clearRefreshTokenCookie(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/auth/me  (protected) ──────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const { default: User } = await import("../../models/User.js");
    const user = await User.findById(req.user.id)
      .select("-passwordHash")
      .populate("linkedChildIds", "name role grade loginDisabled createdAt");

    if (!user) {
      throw new ApiError(404, "User not found", "USER_NOT_FOUND");
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/register-child  (protected: parent only) ────────────────
export const registerChild = async (req, res, next) => {
  try {
    validate(req);
    const { name, grade, attestedGuardianship } = req.body;
    const child = await authService.registerChild({
      name,
      grade,
      parentId: req.user.id,
      attestedGuardianship,
    });

    res.status(201).json({
      success: true,
      data: {
        child: {
          id: child._id,
          _id: child._id,
          name: child.name,
          role: child.role,
          grade: child.grade,
          parentId: child.parentId,
          loginDisabled: child.loginDisabled,
          attestedAt: child.attestedAt,
          createdAt: child.createdAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/google  (public, feature-flagged) ───────────────────────
export const googleAuth = async (req, res, next) => {
  try {
    validate(req);
    const { idToken } = req.body;
    const result = await authService.googleAuth(idToken, req.headers["user-agent"]);

    if (result.profileIncomplete) {
      return res.status(200).json({
        success: true,
        data: {
          profileIncomplete: true,
          reason: result.reason,
          userId: result.user._id,
          name: result.user.name,
          email: result.user.email,
        },
      });
    }

    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: authService.publicUser(result.user),
        accessToken: result.accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/auth/complete-profile  (protected) ──────────────────────────
export const completeProfile = async (req, res, next) => {
  try {
    validate(req);
    const { role, phone } = req.body;
    const user = await authService.completeProfile({ userId: req.user.id, role, phone });

    res.status(200).json({
      success: true,
      data: {
        message: "Profile updated. A verification code has been sent to your phone.",
        userId: user._id,
        role: user.role,
        phoneVerified: user.phoneVerified,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/forgot-password  (public) ───────────────────────────────
// Always returns the same generic response regardless of whether the email
// is registered — see auth.service.js's forgotPassword for why.
export const forgotPassword = async (req, res, next) => {
  try {
    validate(req);
    const { email } = req.body;
    await authService.forgotPassword(email);

    res.status(200).json({
      success: true,
      data: {
        message: "If an account exists for that email, a password reset code has been sent.",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/auth/reset-password  (public) ────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    validate(req);
    const { email, code, newPassword } = req.body;
    await authService.resetPassword({ email, code, newPassword });

    res.status(200).json({
      success: true,
      data: { message: "Password updated. Please log in with your new password." },
    });
  } catch (err) {
    next(err);
  }
};
