import { body, param, query } from "express-validator";
import { locationBodyValidator } from "../../utils/geoValidation.js";
import { MEDIUM_VALUES, CURRICULUM_VALUES } from "../../utils/enums.js";

const priceValidator = () =>
  body("price")
    .optional({ nullable: true })
    .custom((price) => {
      if (price === null) return true;
      if (typeof price !== "object" || Array.isArray(price)) {
        throw new Error("price must be an object");
      }
      if (price.amount !== undefined && (typeof price.amount !== "number" || price.amount < 0)) {
        throw new Error("price.amount must be a non-negative number");
      }
      if (price.unit !== undefined && !["hour", "month"].includes(price.unit)) {
        throw new Error("price.unit must be 'hour' or 'month'");
      }
      return true;
    });

export const createListingValidation = [
  body("type")
    .notEmpty().withMessage("type is required")
    .isIn(["teacher_ad", "student_ad"]).withMessage("type must be teacher_ad or student_ad"),
  body("subject").trim().notEmpty().withMessage("subject is required"),
  body("grade").trim().notEmpty().withMessage("grade is required"),
  body("medium")
    .notEmpty().withMessage("medium is required")
    .isIn(MEDIUM_VALUES).withMessage("medium must be one of: sinhala, tamil, english"),
  body("curriculum")
    .optional({ nullable: true })
    .isIn(CURRICULUM_VALUES).withMessage("curriculum must be one of: local, cambridge, edexcel"),
  priceValidator(),
  body("schedule").optional().isArray().withMessage("schedule must be an array"),
  body("description")
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description must be between 10 and 2000 characters"),
  body("description_si")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description_si must be between 10 and 2000 characters"),
  body("description_ta")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description_ta must be between 10 and 2000 characters"),
  locationBodyValidator(),
  // Present only for a parent posting a student_ad on behalf of a linked child.
  body("targetUserId").optional().isMongoId().withMessage("targetUserId must be a valid id"),
  // Neither is ever client-settable — ownerId is derived server-side, status defaults to active.
  body("ownerId").not().exists().withMessage("ownerId cannot be set directly"),
  body("status").not().exists().withMessage("status cannot be set on create"),
];

export const updateListingValidation = [
  body("type").not().exists().withMessage("type cannot be changed after creation"),
  body("ownerId").not().exists().withMessage("ownerId cannot be changed"),
  body("subject").optional().trim().notEmpty().withMessage("subject cannot be empty"),
  body("grade").optional().trim().notEmpty().withMessage("grade cannot be empty"),
  body("medium")
    .optional()
    .isIn(MEDIUM_VALUES).withMessage("medium must be one of: sinhala, tamil, english"),
  body("curriculum")
    .optional({ nullable: true })
    .isIn(CURRICULUM_VALUES).withMessage("curriculum must be one of: local, cambridge, edexcel"),
  priceValidator(),
  body("schedule").optional().isArray().withMessage("schedule must be an array"),
  body("description")
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description must be between 10 and 2000 characters"),
  body("description_si")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description_si must be between 10 and 2000 characters"),
  body("description_ta")
    .optional({ nullable: true })
    .trim()
    .isLength({ min: 10, max: 2000 }).withMessage("description_ta must be between 10 and 2000 characters"),
  locationBodyValidator(),
  // "flagged" deliberately excluded — that's admin-only, via Phase 14's
  // dedicated moderation endpoint, not the owner-facing update route.
  body("status")
    .optional()
    .isIn(["active", "closed"]).withMessage("status must be 'active' or 'closed'"),
];

export const listingIdParamValidation = [
  param("id").isMongoId().withMessage("Invalid listing id"),
];

export const browseListingsValidation = [
  query("subject").optional().isString(),
  query("grade").optional().isString(),
  query("medium").optional().isIn(MEDIUM_VALUES).withMessage("medium must be one of: sinhala, tamil, english"),
  query("curriculum").optional().isIn(CURRICULUM_VALUES).withMessage("curriculum must be one of: local, cambridge, edexcel"),
  query("minPrice").optional().isFloat({ min: 0 }).withMessage("minPrice must be a non-negative number"),
  query("maxPrice").optional().isFloat({ min: 0 }).withMessage("maxPrice must be a non-negative number"),
  query("lat")
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage("lat must be between -90 and 90")
    .bail()
    .custom((_, { req }) => {
      if (req.query.lng === undefined) throw new Error("lat and lng must be provided together");
      return true;
    }),
  query("lng")
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage("lng must be between -180 and 180")
    .bail()
    .custom((_, { req }) => {
      if (req.query.lat === undefined) throw new Error("lat and lng must be provided together");
      return true;
    }),
  query("radiusKm").optional().isFloat({ min: 0 }).withMessage("radiusKm must be a positive number"),
  query("sort")
    .optional()
    .isIn(["price", "distance", "newest", "rating", "recommended"])
    .withMessage("sort must be one of: price, distance, newest, rating, recommended"),
  query("ownerId").optional().isMongoId().withMessage("ownerId must be a valid id"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 50 }).withMessage("limit must be between 1 and 50"),
];

export const priceSuggestionValidation = [
  query("subject").optional().isString(),
  query("grade").optional().isString(),
  query("medium").optional().isIn(MEDIUM_VALUES).withMessage("medium must be one of: sinhala, tamil, english"),
];
