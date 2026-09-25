import * as searchService from "./search.service.js";
import { logEventFromRequest } from "../../services/event.service.js";
import { attachListingOwners } from "../../utils/presenters.js";

// ─── POST /api/search/semantic  (public, optional auth) ─────────────────────
export const semanticSearch = async (req, res, next) => {
  try {
    const { listings, pagination } = await searchService.semanticSearch(req.user || null, req.body);

    // Reuses the same "search" action Phase 7 already logs for /browse —
    // this is still a search, just a semantic one; metadata.semantic
    // distinguishes it for anyone querying the Event log later.
    logEventFromRequest(req, { action: "search", metadata: { ...req.body, semantic: true } });

    res.status(200).json({ success: true, data: { listings: await attachListingOwners(listings), pagination } });
  } catch (err) {
    next(err);
  }
};
