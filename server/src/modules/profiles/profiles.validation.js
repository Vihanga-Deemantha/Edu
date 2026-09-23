import { body, param } from "express-validator";
import { locationBodyValidator } from "../../utils/geoValidation.js";
import { MEDIUM_VALUES, CURRICULUM_VALUES } from "../../utils/enums.js";

/**
 * All body validators here are `.optional()` — PUT is used with upsert
 * semantics and partial bodies are allowed (see spec §6: "any subset of the
 * fields"). Whether a *new* profile has enough fields to actually be created
 * is a business rule checked explicitly in profiles.service.js, with a clear
 * error message, rather than leaning on Mongoose's schema-level `required`
 * bubbling up through findOneAndUpdate as a generic validation error.
 */

const nonEmptyStringArray = (field, label) =>
  body(field)
    .optional()
    .isArray({ min: 1 }).withMessage(`${label} must be a non-empty array`)
    .bail()
    .custom((arr) => arr.every((v) => typeof v === "string" && v.trim().length > 0))
    .withMessage(`${label} must contain only non-empty strings`);

const enumArray = (field, label, allowed) =>
  body(field)
    .optional()
    .isArray({ min: 1 }).withMessage(`${label} must be a non-empty array`)
    .bail()
    .custom((arr) => arr.every((v) => allowed.includes(v)))
    .withMessage(`${label} must only contain: ${allowed.join(", ")}`);

// Reject the derived/admin-only fields outright if a client sends them at
// all — fail loud rather than silently drop, so a future frontend that
// starts relying on "I can set this" finds out immediately, not in production.
const rejectReadOnlyTeacherFields = [
  body("verificationStatus").not().exists().withMessage("verificationStatus cannot be set directly"),
  body("avgRating").not().exists().withMessage("avgRating cannot be set directly"),
  body("reviewCount").not().exists().withMessage("reviewCount cannot be set directly"),
];

export const upsertTeacherProfileValidation = [
  nonEmptyStringArray("subjects", "subjects"),
  nonEmptyStringArray("grades", "grades"),
  enumArray("medium", "medium", MEDIUM_VALUES),
  enumArray("classType", "classType", ["individual", "group", "online", "home_visit"]),
  body("curriculum")
    .optional()
    .isArray().withMessage("curriculum must be an array")
    .bail()
    .custom((arr) => arr.every((v) => CURRICULUM_VALUES.includes(v)))
    .withMessage("curriculum must only contain: local, cambridge, edexcel"),
  body("bio").optional().isString().isLength({ max: 1000 }).withMessage("bio must be at most 1000 characters"),
  body("qualifications").optional().isArray().withMessage("qualifications must be an array"),
  body("experienceYears").optional().isInt({ min: 0 }).withMessage("experienceYears must be a non-negative integer"),
  body("photoUrl").optional({ nullable: true }).isString(),
  body("introVideoUrl").optional({ nullable: true }).isString(),
  locationBodyValidator(),
  ...rejectReadOnlyTeacherFields,
];

export const upsertStudentProfileValidation = [
  body("targetUserId")
    .notEmpty().withMessage("targetUserId is required")
    .isMongoId().withMessage("targetUserId must be a valid id"),
  body("gradeOrLevel").optional({ nullable: true }).isString(),
  body("subjectsInterested").optional().isArray().withMessage("subjectsInterested must be an array"),
  body("medium")
    .optional()
    .isArray().withMessage("medium must be an array")
    .bail()
    .custom((arr) => arr.every((v) => MEDIUM_VALUES.includes(v)))
    .withMessage("medium must only contain: sinhala, tamil, english"),
  locationBodyValidator(),
];

export const userIdParamValidation = [
  param("userId").isMongoId().withMessage("Invalid userId"),
];
