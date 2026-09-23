import { validationResult } from "express-validator";
import * as profilesService from "./profiles.service.js";
import ApiError from "../../utils/ApiError.js";
import { logEventFromRequest } from "../../services/event.service.js";

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
    err.details = errors.array();
    throw err;
  }
};

// ─── PUT /api/profiles/teacher  (protected: teacher only) ───────────────────
export const upsertTeacherProfile = async (req, res, next) => {
  try {
    validate(req);
    const profile = await profilesService.upsertTeacherProfile(req.user.id, req.body);
    res.status(200).json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/profiles/teacher/:userId  (public) ─────────────────────────────
export const getTeacherProfile = async (req, res, next) => {
  try {
    validate(req);
    const profile = await profilesService.getPublicTeacherProfile(req.params.userId);

    logEventFromRequest(req, {
      action: "view_profile",
      targetType: "profile",
      targetId: profile.userId,
      metadata: { role: "teacher" },
    });

    res.status(200).json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/profiles/student  (protected: student or parent) ──────────────
export const upsertStudentProfile = async (req, res, next) => {
  try {
    validate(req);
    const { targetUserId, ...fields } = req.body;
    const profile = await profilesService.upsertStudentProfile({
      requesterId: req.user.id,
      targetUserId,
      ...fields,
    });
    res.status(200).json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/profiles/student/:userId  (protected: teacher, student, parent) ─
export const getStudentProfile = async (req, res, next) => {
  try {
    validate(req);
    const profile = await profilesService.getStudentProfile({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      targetUserId: req.params.userId,
    });

    // Logged unconditionally, including self/parent-of-self views — a raw
    // event log shouldn't drop data based on assumptions about how it'll be
    // used later; a consumer (Phase 12/15) can filter self-views out at
    // query time if that turns out to matter for a given analysis.
    logEventFromRequest(req, {
      action: "view_profile",
      targetType: "profile",
      targetId: profile.userId,
      metadata: { role: "student" },
    });

    res.status(200).json({ success: true, data: { profile } });
  } catch (err) {
    next(err);
  }
};
