/**
 * Shared enum value lists — TeacherProfile, StudentProfile, and Listing (plus
 * their validators) all constrain to the same medium/curriculum vocabulary.
 * A single source of truth here means adding or renaming a value is a
 * one-file change instead of hunting down every hand-copied literal array
 * across models and validators, where missing one lets a Mongoose schema
 * silently accept a value express-validator rejects, or vice versa.
 */

export const MEDIUM_VALUES = ["sinhala", "tamil", "english"];

export const CURRICULUM_VALUES = ["local", "cambridge", "edexcel"];
