import mongoose from "mongoose";

/**
 * TeacherVerification — stores sensitive identity and qualification documents
 * for teacher trust & safety checks.
 *
 * DESIGN PRINCIPLES (from spec C1):
 * - Completely separate from TeacherProfile (Phase 2) — document C never
 *   shares a schema or access path with publicly-browsable data.
 * - adminNotes is NEVER exposed through teacher-facing or public endpoints.
 * - Document URLs should point to private/signed storage — never public S3/CDN.
 * - verificationTier is set only by admin action (Phase 14), never self-set.
 *
 * KNOWN LIMITATION: nicNumber is stored as plaintext — field-level encryption
 * is the correct production solution but is out of scope for the portfolio version.
 */
const teacherVerificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one verification record per teacher
      index: true,
    },

    // Sri Lanka NIC number — plaintext (see known limitation above)
    nicNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // Private URL to front+back NIC scan — must be signed/access-controlled
    nicDocumentUrl: {
      type: String,
      required: true,
    },

    // Photo of person holding ID next to face — manual liveness check
    selfieWithIdUrl: {
      type: String,
      required: true,
    },

    // Academic/professional qualifications — at least one required for fully_verified tier
    qualificationDocuments: [
      {
        title: { type: String, required: true },
        issuer: { type: String, required: true },
        fileUrl: { type: String, required: true },
      },
    ],

    // Sri Lanka Police Certificate of Good Conduct — required for fully_verified tier
    policeClearanceUrl: {
      type: String,
      default: null,
    },

    policeClearanceIssuedAt: {
      type: Date,
      default: null,
    },

    // Admin should flag re-submission after 12 months from this date
    policeClearanceExpiresAt: {
      type: Date,
      default: null,
    },

    // Optional character references (previous schools/institutes)
    references: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        contact: { type: String, required: true },
      },
    ],

    /**
     * verificationTier — what this teacher is currently approved for.
     * Set ONLY by admin action (Phase 14). Never accepts input from teachers.
     *
     * none        → can build profile, invisible in search
     * id_verified → appears in search, can receive interest from adult students
     * fully_verified → can receive interest involving child-linked accounts
     */
    verificationTier: {
      type: String,
      enum: ["none", "id_verified", "fully_verified"],
      default: "none",
    },

    // Lifecycle status of the submission
    status: {
      type: String,
      enum: ["not_submitted", "pending_review", "approved", "rejected", "expired"],
      default: "not_submitted",
    },

    // Admin who last reviewed this — set in Phase 14
    adminReviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * INTERNAL ONLY — never exposed through any teacher-facing or public endpoint.
     * Contains reviewer notes, rejection reasons, etc.
     */
    adminNotes: {
      type: String,
      default: null,
      select: false, // excluded from all queries unless explicitly selected
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const TeacherVerification = mongoose.model("TeacherVerification", teacherVerificationSchema);

export default TeacherVerification;
