import * as listingsService from "./listings.service.js";
import { logEventFromRequest } from "../../services/event.service.js";
import { attachListingOwners, presentListing } from "../../utils/presenters.js";

// Request validation now happens in the `validate` route middleware
// (server/src/middleware/validate.js).

// ─── POST /api/listings  (protected: teacher, student, parent) ──────────────
export const createListing = async (req, res, next) => {
  try {
    const listing = await listingsService.createListing({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      ...req.body,
    });
    res.status(201).json({ success: true, data: { listing } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/listings/mine  (protected) ─────────────────────────────────────
export const getMyListings = async (req, res, next) => {
  try {
    const listings = await listingsService.getMyListingsWithStats(req.user.id, req.user.role);
    res.status(200).json({ success: true, data: { listings } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/listings/browse  (public, optional auth) ───────────────────────
export const browseListings = async (req, res, next) => {
  try {
    const { listings, pagination } = await listingsService.browseListings(req.user || null, req.query);

    // Logged unconditionally, including zero-result searches — a query with
    // no matches is exactly the "high demand, no supply" signal Phase 15's
    // analytics wants to surface later. Fire-and-forget: not awaited.
    logEventFromRequest(req, { action: "search", metadata: { ...req.query } });

    res.status(200).json({ success: true, data: { listings: await attachListingOwners(listings), pagination } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/listings/:id  (optional auth — guests allowed) ────────────────
export const getListing = async (req, res, next) => {
  try {
    const listing = await listingsService.getListingById(req.params.id, req.user || null);

    // Only reached once getListingById's visibility check has already
    // passed — a blocked/404'd attempt is never logged as a "view".
    logEventFromRequest(req, {
      action: "view_listing",
      targetType: "listing",
      targetId: listing._id,
      metadata: { type: listing.type, subject: listing.subject, grade: listing.grade },
    });

    res.status(200).json({ success: true, data: { listing: await presentListing(listing) } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/listings/:id  (protected, owner/parent-of-owner only) ───────
export const updateListing = async (req, res, next) => {
  try {
    const listing = await listingsService.updateListing({
      listingId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
      updates: req.body,
    });
    res.status(200).json({ success: true, data: { listing } });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/listings/:id  (protected — soft delete via status:"closed") ─
export const closeListing = async (req, res, next) => {
  try {
    const listing = await listingsService.closeListing(req.params.id, req.user.id, req.user.role);
    res.status(200).json({ success: true, data: { listing } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/listings/price-suggestion  (protected: teacher) ───────────────
export const getPriceSuggestion = async (req, res, next) => {
  try {
    const result = await listingsService.getPriceSuggestion(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
