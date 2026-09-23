import { Router } from "express";
import * as reportsController from "./reports.controller.js";
import { createReportValidation } from "./reports.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * POST /api/reports
 * Protected, any authenticated role. Generic — targetType covers
 * review|listing|user, all feeding the same Phase 14 moderation queue.
 */
router.post("/", authenticate, createReportValidation, validate, reportsController.createReport);

export default router;
