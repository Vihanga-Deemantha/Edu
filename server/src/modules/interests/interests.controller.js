import * as interestsService from "./interests.service.js";
import * as chatService from "../chat/chat.service.js";
import { logEventFromRequest } from "../../services/event.service.js";
import { enqueueNotificationJob } from "../../queues/notification.queue.js";

// ─── POST /api/interests  (protected: teacher, student, parent) ─────────────
export const createInterestRequest = async (req, res, next) => {
  try {
    const { interestRequest, listing } = await interestsService.createInterestRequest({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      ...req.body,
    });

    enqueueNotificationJob({
      userId: interestRequest.toUserId,
      type: "interest_received",
      payload: { subject: listing.subject },
    });
    logEventFromRequest(req, {
      action: "interest_sent",
      targetType: "listing",
      targetId: listing._id,
      metadata: { type: listing.type, subject: listing.subject },
    });

    res.status(201).json({ success: true, data: { interestRequest } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/interests/sent  (protected) ─────────────────────────────────
export const getSentInterests = async (req, res, next) => {
  try {
    const { interests, pagination } = await interestsService.getSentInterests(
      req.user.id,
      req.user.role,
      req.query
    );
    res.status(200).json({ success: true, data: { interests, pagination } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/interests/received  (protected) ────────────────────────────────
export const getReceivedInterests = async (req, res, next) => {
  try {
    const { interests, pagination } = await interestsService.getReceivedInterests(
      req.user.id,
      req.user.role,
      req.query
    );
    res.status(200).json({ success: true, data: { interests, pagination } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/interests/:id/respond  (protected, toUserId only) ───────────
export const respondToInterestRequest = async (req, res, next) => {
  try {
    const { interestRequest, listing } = await interestsService.respondToInterestRequest({
      interestId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
      status: req.body.status,
    });

    enqueueNotificationJob({
      userId: interestRequest.fromUserId,
      type: interestRequest.status === "accepted" ? "interest_accepted" : "interest_declined",
      payload: { subject: listing.subject },
    });

    let conversation = null;
    if (interestRequest.status === "accepted") {
      logEventFromRequest(req, {
        action: "interest_accepted",
        targetType: "listing",
        targetId: interestRequest.listingId,
        metadata: { subject: listing.subject },
      });
      // Best-effort, like the notification/event calls above — NOT because
      // the conversation doesn't matter, but because interestRequest.status
      // was already saved as "accepted" above (in respondToInterestRequest),
      // so by this point the accept has already happened. Letting a
      // conversation-creation failure bubble up as a request error would
      // leave the client believing accept failed while the server thinks it
      // succeeded — a retry would then just 400 with INVALID_STATE (already
      // accepted) and there's no other call site that ever retries this, so
      // the interest would be stuck accepted with no conversation and no way
      // to get one. The REST response's fromContact/toContact fields (see
      // serializeInterestRequest) remain a working fallback channel either
      // way, so failing soft here doesn't leave anyone with no way to connect.
      try {
        conversation = await chatService.getOrCreateConversation(interestRequest);
      } catch (err) {
        console.error("Failed to create chat conversation for accepted interest:", err.message);
      }
    }

    // Serialized (not the raw document) specifically so an accept response
    // actually carries the newly-revealed contact info the spec calls for —
    // returning the raw document here would silently omit it.
    const serialized = await interestsService.serializeInterestRequest(interestRequest);
    res.status(200).json({
      success: true,
      data: { interestRequest: serialized, conversationId: conversation?._id ?? null },
    });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/interests/:id/complete  (protected, either participant) ─────
export const completeInterestRequest = async (req, res, next) => {
  try {
    const { interestRequest, listing, notifyUserId } = await interestsService.completeInterestRequest({
      interestId: req.params.id,
      requesterId: req.user.id,
      requesterRole: req.user.role,
    });

    enqueueNotificationJob({
      userId: notifyUserId,
      type: "interest_completed",
      payload: { subject: listing.subject },
    });

    const serialized = await interestsService.serializeInterestRequest(interestRequest);
    res.status(200).json({ success: true, data: { interestRequest: serialized } });
  } catch (err) {
    next(err);
  }
};
