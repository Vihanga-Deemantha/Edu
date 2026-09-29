import { body } from "express-validator";
import { MEDIUM_VALUES, CURRICULUM_VALUES, CLASS_TYPE_VALUES } from "../../utils/enums.js";

export const semanticSearchValidation = [
  body("query")
    .trim()
    .notEmpty()
    .withMessage("query is required")
    .isLength({ max: 500 })
    .withMessage("query must be at most 500 characters"),
  body("subject").optional().isString(),
  body("grade").optional().isString(),
  body("medium").optional().isIn(MEDIUM_VALUES).withMessage("medium must be one of: sinhala, tamil, english"),
  body("curriculum")
    .optional()
    .isIn(CURRICULUM_VALUES)
    .withMessage("curriculum must be one of: local, cambridge, edexcel"),
  body("classType").optional().isIn(CLASS_TYPE_VALUES).withMessage(`classType must be one of: ${CLASS_TYPE_VALUES.join(", ")}`),
  body("verifiedOnly").optional().isBoolean().withMessage("verifiedOnly must be a boolean").toBoolean(),
  body("minPrice").optional().isFloat({ min: 0 }).withMessage("minPrice must be a non-negative number"),
  body("maxPrice").optional().isFloat({ min: 0 }).withMessage("maxPrice must be a non-negative number"),
  body("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  body("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];
