import TeacherVerification from "../../models/TeacherVerification.js";
import ApiError from "../../utils/ApiError.js";

/**
 * Submit or resubmit teacher verification documents.
 *
 * Policy:
 * - Can only submit when status is 'not_submitted', 'rejected', or 'expired'
 * - Attempting to submit over a 'pending_review' or 'approved' record → 409
 */
export const submitVerification = async ({
  userId,
  nicNumber,
  nicDocumentUrl,
  selfieWithIdUrl,
  qualificationDocuments,
  policeClearanceUrl,
  policeClearanceIssuedAt,
  references,
}) => {
  const existing = await TeacherVerification.findOne({ userId });

  if (existing) {
    const blockingStatuses = ["pending_review", "approved"];
    if (blockingStatuses.includes(existing.status)) {
      throw new ApiError(
        409,
        `Cannot resubmit — current status is '${existing.status}'. Contact support if you believe this is an error.`,
        "VERIFICATION_ALREADY_ACTIVE"
      );
    }

    // Update existing record (e.g. after rejection or expiry)
    existing.nicNumber = nicNumber;
    existing.nicDocumentUrl = nicDocumentUrl;
    existing.selfieWithIdUrl = selfieWithIdUrl;
    existing.qualificationDocuments = qualificationDocuments || [];
    existing.policeClearanceUrl = policeClearanceUrl || null;
    existing.policeClearanceIssuedAt = policeClearanceIssuedAt || null;
    existing.references = references || [];
    existing.status = "pending_review";
    existing.submittedAt = new Date();
    existing.reviewedAt = null;
    existing.adminReviewerId = null;
    await existing.save();
    return existing;
  }

  // First submission
  const verification = await TeacherVerification.create({
    userId,
    nicNumber,
    nicDocumentUrl,
    selfieWithIdUrl,
    qualificationDocuments: qualificationDocuments || [],
    policeClearanceUrl: policeClearanceUrl || null,
    policeClearanceIssuedAt: policeClearanceIssuedAt || null,
    references: references || [],
    status: "pending_review",
    submittedAt: new Date(),
  });

  return verification;
};

/**
 * Get the calling teacher's own verification status.
 * NEVER returns adminNotes.
 */
export const getMyVerification = async (userId) => {
  const verification = await TeacherVerification.findOne({ userId })
    .select("-adminNotes"); // belt-and-suspenders: also select: false on schema

  return verification; // null if never submitted — frontend shows 'not_submitted' state
};

/**
 * Look up a single stored document field (a Cloudinary public_id) for
 * signed-URL viewing. Used only by the permission-checked document-view
 * route — never exposes the whole record.
 */
export const getVerificationDocumentField = async (userId, field) => {
  const verification = await TeacherVerification.findOne({ userId });
  return verification ? verification[field] : null;
};
