import { body } from "express-validator";

// A document reference is either a Cloudinary public_id (what a direct
// signed upload returns, and what upload.service.js's getSignedViewUrl
// expects) or a plain https URL (dev environments without Cloudinary).
const PUBLIC_ID = /^[\w\-./]{1,300}$/;
const isDocumentRef = (value) => {
  if (/^https?:\/\//i.test(value)) return true;
  if (PUBLIC_ID.test(value)) return true;
  throw new Error("must be an uploaded document reference or a URL");
};

export const submitVerificationValidation = [
  body("nicNumber")
    .trim()
    .notEmpty().withMessage("NIC number is required"),

  body("nicDocumentUrl")
    .trim()
    .notEmpty().withMessage("NIC document URL is required")
    .custom(isDocumentRef).withMessage("nicDocumentUrl must be an uploaded document reference or a URL"),

  body("selfieWithIdUrl")
    .trim()
    .notEmpty().withMessage("Selfie-with-ID URL is required")
    .custom(isDocumentRef).withMessage("selfieWithIdUrl must be an uploaded document reference or a URL"),

  body("qualificationDocuments")
    .optional()
    .isArray().withMessage("qualificationDocuments must be an array"),

  body("qualificationDocuments.*.title")
    .if(body("qualificationDocuments").exists())
    .notEmpty().withMessage("Each qualification must have a title"),

  body("qualificationDocuments.*.issuer")
    .if(body("qualificationDocuments").exists())
    .notEmpty().withMessage("Each qualification must have an issuer"),

  body("qualificationDocuments.*.fileUrl")
    .if(body("qualificationDocuments").exists())
    .custom(isDocumentRef).withMessage("Each qualification must have a valid file reference"),

  body("policeClearanceUrl")
    .optional()
    .custom(isDocumentRef).withMessage("policeClearanceUrl must be an uploaded document reference or a URL"),

  body("policeClearanceIssuedAt")
    .optional()
    .isISO8601().withMessage("policeClearanceIssuedAt must be a valid date"),

  body("references")
    .optional()
    .isArray().withMessage("references must be an array"),

  body("references.*.name")
    .if(body("references").exists())
    .notEmpty().withMessage("Each reference must have a name"),

  body("references.*.relationship")
    .if(body("references").exists())
    .notEmpty().withMessage("Each reference must have a relationship"),

  body("references.*.contact")
    .if(body("references").exists())
    .notEmpty().withMessage("Each reference must have a contact"),
];
