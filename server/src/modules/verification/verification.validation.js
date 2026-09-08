import { body } from "express-validator";

export const submitVerificationValidation = [
  body("nicNumber")
    .trim()
    .notEmpty().withMessage("NIC number is required"),

  body("nicDocumentUrl")
    .trim()
    .notEmpty().withMessage("NIC document URL is required")
    .isURL().withMessage("nicDocumentUrl must be a valid URL"),

  body("selfieWithIdUrl")
    .trim()
    .notEmpty().withMessage("Selfie-with-ID URL is required")
    .isURL().withMessage("selfieWithIdUrl must be a valid URL"),

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
    .isURL().withMessage("Each qualification must have a valid file URL"),

  body("policeClearanceUrl")
    .optional()
    .isURL().withMessage("policeClearanceUrl must be a valid URL"),

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
