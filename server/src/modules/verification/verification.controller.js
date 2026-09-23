import * as verificationService from "./verification.service.js";
import ApiError from "../../utils/ApiError.js";
import { getSignedUploadParams, getSignedViewUrl } from "../../services/upload.service.js";

// Only these flat URL/public_id fields are viewable one at a time through
// this route — qualificationDocuments is an array and isn't wired up here yet.
const VIEWABLE_FIELDS = ["nicDocumentUrl", "selfieWithIdUrl", "policeClearanceUrl"];

// Request validation now happens in the `validate` route middleware
// (server/src/middleware/validate.js).

// ─── POST /api/verification/teacher/submit ───────────────────────────────────
export const submitVerification = async (req, res, next) => {
  try {
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

// ─── GET /api/verification/teacher/upload-signature ─────────────────────────
// Protected, teacher only. Returns signed params for a direct-to-Cloudinary
// upload — the file itself never passes through this server.
export const getUploadSignature = async (req, res, next) => {
  try {
    const params = getSignedUploadParams({ folder: `teacher-verification/${req.user.id}` });
    res.status(200).json({ success: true, data: params });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/verification/document/:userId/:field ──────────────────────────
// Protected: the owning teacher, or an admin. Returns a short-lived signed
// URL to view one stored document — never the raw stored value directly,
// and never to anyone other than the owner/admin (spec §C5).
export const viewDocument = async (req, res, next) => {
  try {
    const { userId, field } = req.params;

    if (!VIEWABLE_FIELDS.includes(field)) {
      throw new ApiError(400, "Unknown document field", "INVALID_FIELD");
    }

    if (req.user.id !== userId && req.user.role !== "admin") {
      throw new ApiError(403, "You do not have permission to view this document", "FORBIDDEN");
    }

    const publicId = await verificationService.getVerificationDocumentField(userId, field);
    if (!publicId) {
      throw new ApiError(404, "Document not found", "NOT_FOUND");
    }

    const url = getSignedViewUrl(publicId);
    res.status(200).json({ success: true, data: { url, expiresInSeconds: 300 } });
  } catch (err) {
    next(err);
  }
};
