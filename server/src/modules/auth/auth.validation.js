import { body } from "express-validator";

// ─── REGISTRATION ────────────────────────────────────────────────────────────

export const registerValidation = [
  body("name").trim().notEmpty().withMessage("Name is required"),

  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email"),

  body("phone")
    .trim()
    .notEmpty().withMessage("Phone is required")
    .matches(/^(\+94|0)[0-9]{9}$/)
    .withMessage("Phone must be a valid Sri Lankan number (+94XXXXXXXXX or 0XXXXXXXXX)"),

  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),

  body("role")
    .notEmpty().withMessage("Role is required")
    .isIn(["teacher", "student", "parent"])
    .withMessage("Role must be one of: teacher, student, parent. Admin accounts cannot be self-registered."),
];

// ─── LOGIN ───────────────────────────────────────────────────────────────────

export const loginValidation = [
  body("email")
    .trim()
    .notEmpty().withMessage("Email is required")
    .isEmail().withMessage("Please provide a valid email"),

  body("password")
    .notEmpty().withMessage("Password is required"),
];

// ─── OTP ─────────────────────────────────────────────────────────────────────

export const verifyOtpValidation = [
  body("userId")
    .notEmpty().withMessage("userId is required")
    .isMongoId().withMessage("Invalid userId"),

  body("channel")
    .notEmpty().withMessage("channel is required")
    .isIn(["email", "phone"]).withMessage("channel must be 'email' or 'phone'"),

  body("code")
    .notEmpty().withMessage("code is required")
    .matches(/^\d{6}$/).withMessage("code must be a 6-digit number"),
];

export const resendOtpValidation = [
  body("userId")
    .notEmpty().withMessage("userId is required")
    .isMongoId().withMessage("Invalid userId"),

  body("channel")
    .notEmpty().withMessage("channel is required")
    .isIn(["email", "phone"]).withMessage("channel must be 'email' or 'phone'"),
];

// ─── CHILD REGISTRATION ──────────────────────────────────────────────────────

export const registerChildValidation = [
  body("name").trim().notEmpty().withMessage("Child name is required"),
  body("grade").optional().isString().withMessage("Grade must be a string"),
  body("attestedGuardianship")
    .exists().withMessage("attestedGuardianship is required")
    .custom((val) => val === true || val === "true")
    .withMessage("You must confirm that you are the parent or legal guardian of this child."),
];

// ─── GOOGLE AUTH ─────────────────────────────────────────────────────────────

export const googleAuthValidation = [
  body("idToken")
    .notEmpty().withMessage("idToken is required")
    .isString().withMessage("idToken must be a string"),
];

export const completeProfileValidation = [
  body("role")
    .notEmpty().withMessage("role is required")
    .isIn(["teacher", "student", "parent"])
    .withMessage("Role must be one of: teacher, student, parent"),

  body("phone")
    .trim()
    .notEmpty().withMessage("Phone is required")
    .matches(/^(\+94|0)[0-9]{9}$/)
    .withMessage("Phone must be a valid Sri Lankan number (+94XXXXXXXXX or 0XXXXXXXXX)"),
];
