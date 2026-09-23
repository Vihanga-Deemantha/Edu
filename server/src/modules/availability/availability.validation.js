import { body, param } from "express-validator";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const createAvailabilityValidation = [
  body("dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("dayOfWeek must be an integer between 0 (Sunday) and 6 (Saturday)"),
  body("startTime").matches(HH_MM).withMessage("startTime must be in 24-hour HH:mm format"),
  body("endTime")
    .matches(HH_MM)
    .withMessage("endTime must be in 24-hour HH:mm format")
    .custom((endTime, { req }) => endTime > req.body.startTime)
    .withMessage("endTime must be after startTime"),
];

export const teacherIdParamValidation = [param("teacherId").isMongoId().withMessage("Invalid teacherId")];

export const availabilityIdParamValidation = [param("id").isMongoId().withMessage("Invalid availability id")];
