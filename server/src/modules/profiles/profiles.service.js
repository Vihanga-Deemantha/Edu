import TeacherProfile from "../../models/TeacherProfile.js";
import StudentProfile from "../../models/StudentProfile.js";
import TeacherVerification from "../../models/TeacherVerification.js";
import ApiError from "../../utils/ApiError.js";
import { isRequesterParentOf } from "../../utils/familyAccess.js";

const READ_ONLY_TEACHER_FIELDS = ["verificationStatus", "avgRating", "reviewCount"];
const REQUIRED_ON_CREATE = ["subjects", "grades", "medium", "classType"];

const stripReadOnlyFields = (fields) => {
  const clean = { ...fields };
  for (const key of READ_ONLY_TEACHER_FIELDS) delete clean[key];
  return clean;
};

// ─── TEACHER PROFILE ─────────────────────────────────────────────────────────

/**
 * Create or update the calling teacher's own profile (upsert — same call
 * handles both). Partial bodies are allowed on update; a brand-new profile
 * must include the fields a profile can't meaningfully exist without.
 */
export const upsertTeacherProfile = async (userId, rawFields) => {
  // Defense in depth — strip read-only fields even though validation should
  // already have rejected a request that included them at all.
  const fields = stripReadOnlyFields(rawFields);

  const existing = await TeacherProfile.findOne({ userId });

  if (existing) {
    // Mutate the already-loaded document and .save() it, rather than a
    // second findOneAndUpdate re-querying the identical document. Also
    // sidesteps the upsert:true + runValidators gotcha this codebase hit
    // once already: Mongoose's required-field validators on
    // findOneAndUpdate run against the update operators themselves (not the
    // matched document) whenever upsert is enabled, since it validates
    // before knowing whether the query will match — with upsert:true, a
    // partial `{ $set: { bio: "..." } }` update was rejected as "missing"
    // subjects/grades/medium/classType even though the existing document
    // already had all of them. `.save()` on an already-loaded, known-to-exist
    // document validates its full current state instead, with no such
    // ambiguity and no second round trip.
    Object.assign(existing, fields);
    await existing.save();
    return existing;
  }

  const missing = REQUIRED_ON_CREATE.filter(
    (key) => !fields[key] || fields[key].length === 0
  );
  if (missing.length > 0) {
    throw new ApiError(
      422,
      `A new profile needs: ${missing.join(", ")}`,
      "VALIDATION_ERROR"
    );
  }

  // A teacher may already have gone through document verification (Phase 0
  // upgrade) before ever building a profile — pick up their current tier now
  // instead of defaulting to "none" and waiting on Phase 14 to touch this
  // specific document.
  const verification = await TeacherVerification.findOne({ userId });
  fields.verificationStatus = verification ? verification.verificationTier : "none";

  return TeacherProfile.create({ userId, ...fields });
};

/**
 * Public read — no auth required. 404 (not 500) when the teacher hasn't
 * built a profile yet; that's an expected state, not an error.
 */
export const getPublicTeacherProfile = async (userId) => {
  const profile = await TeacherProfile.findOne({ userId });
  if (!profile) {
    throw new ApiError(404, "Teacher profile not found", "PROFILE_NOT_FOUND");
  }
  return profile;
};

/**
 * Exported for Phase 14 (admin) to call once approve/reject exists — keeps
 * TeacherProfile.verificationStatus in sync with the source-of-truth
 * TeacherVerification.verificationTier going forward. Not wired to any route
 * in this phase; having it ready now means Phase 14 is a one-line call
 * instead of a new sync mechanism invented late.
 */
export const syncTeacherVerificationStatus = async (userId, newTier) => {
  await TeacherProfile.findOneAndUpdate({ userId }, { $set: { verificationStatus: newTier } });
};

// ─── STUDENT PROFILE ──────────────────────────────────────────────────────────

/**
 * Create or update a student profile — the caller's own, or (for a parent) a
 * linked child's. Trust boundary matches register-child from Phase 0: a
 * parent acts FOR a child by verified ID, never via the child authenticating.
 */
export const upsertStudentProfile = async ({ requesterId, targetUserId, ...fields }) => {
  if (requesterId !== String(targetUserId) && !(await isRequesterParentOf(requesterId, targetUserId))) {
    throw new ApiError(
      403,
      "You can only manage a profile for yourself or a linked child account.",
      "FORBIDDEN"
    );
  }

  // Same reasoning as upsertTeacherProfile above — fetch once, mutate,
  // .save(), instead of a second findOneAndUpdate re-querying the same doc.
  const existing = await StudentProfile.findOne({ userId: targetUserId });

  if (existing) {
    Object.assign(existing, fields);
    await existing.save();
    return existing;
  }

  return StudentProfile.create({ userId: targetUserId, ...fields });
};

/**
 * Read a student profile — never public. A teacher may view any student
 * profile (needed to evaluate a wanted-ad's fit); a student may view only
 * their own; a parent may view only a linked child's.
 */
export const getStudentProfile = async ({ requesterId, requesterRole, targetUserId }) => {
  if (
    requesterRole !== "teacher" &&
    requesterId !== String(targetUserId) &&
    !(await isRequesterParentOf(requesterId, targetUserId))
  ) {
    throw new ApiError(403, "You do not have permission to view this profile.", "FORBIDDEN");
  }

  const profile = await StudentProfile.findOne({ userId: targetUserId });
  if (!profile) {
    throw new ApiError(404, "Student profile not found", "PROFILE_NOT_FOUND");
  }
  return profile;
};
