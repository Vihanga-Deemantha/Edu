import { Router } from "express";
import * as searchController from "./search.controller.js";
import { semanticSearchValidation } from "./search.validation.js";
import optionalAuthenticate from "../../middleware/optionalAuthenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * POST /api/search/semantic
 * Public, optional auth — same "guests can browse" rule as /browse
 * (Phase 6B); a body, not query params, since a free-text query doesn't
 * fit cleanly into a GET.
 */
router.post("/semantic", optionalAuthenticate, semanticSearchValidation, validate, searchController.semanticSearch);

export default router;
