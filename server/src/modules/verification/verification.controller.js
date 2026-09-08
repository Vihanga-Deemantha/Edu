import { validationResult } from "express-validator";
import * as verificationService from "./verification.service.js";
import ApiError from "../../utils/ApiError.js";

const validate = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new ApiError(422, errors.array()[0].msg, "VALIDATION_ERROR");
    err.details = errors.array();
    throw err;
  }
};

// ─── POST /api/verification/teacher/submit ───────────────────────────────────
export const submitVerification = async (req, res, next) => {
  try {
    validate(req);
    const {
      nicNumber,
      nicDocumentUrl,
      selfieWithIdUrl,
      qualificationDocuments,
      policeClearanceUrl,
      policeClearanceIssuedAt,
      references,
    } = req.body;

    const verification = await verificationService.submitVerification({
      userId: req.user.id,
      nicNumber,
      nicDocumentUrl,
      selfieWithIdUrl,
      qualificationDocuments,
      policeClearanceUrl,
      policeClearanceIssuedAt,
      references,
    });

    res.status(201).json({
      success: true,
      data: {
        // adminNotes intentionally excluded
        status: verification.status,
        verificationTier: verification.verificationTier,
        submittedAt: verification.submittedAt,
        message: "Verification documents submitted. An admin will review your submission.",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/verification/teacher/me ───────────────────────────────────────
export const getMyVerification = async (req, res, next) => {
  try {
    const verification = await verificationService.getMyVerification(req.user.id);

    if (!verification) {
      return res.status(200).json({
        success: true,
        data: {
          status: "not_submitted",
          verificationTier: "none",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        // adminNotes NEVER returned here
        status: verification.status,
        verificationTier: verification.verificationTier,
        submittedAt: verification.submittedAt,
        reviewedAt: verification.reviewedAt,
        qualificationDocuments: verification.qualificationDocuments,
        policeClearanceUrl: verification.policeClearanceUrl,
        policeClearanceIssuedAt: verification.policeClearanceIssuedAt,
        policeClearanceExpiresAt: verification.policeClearanceExpiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};
