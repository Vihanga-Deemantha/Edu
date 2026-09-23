import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import ApiError from "../../utils/ApiError.js";
import { accountHolderId } from "../../utils/familyAccess.js";
import { resolveInterestSides } from "../interests/interests.service.js";

/**
 * Creates the conversation for a just-accepted InterestRequest — called
 * once, from interests.controller.js right after a successful accept.
 * Race-free / idempotent the same way Review's linkedRequestId uniqueness
 * is handled: try the create, and if a duplicate-key error means one
 * already exists (a retried request, for instance), just return that one
 * instead of erroring.
 */
export const getOrCreateConversation = async (interestRequest) => {
  const { fromUser, toUser } = await resolveInterestSides(interestRequest);
  if (!fromUser || !toUser) {
    // Same "can't build a conversation without two real participants" case
    // as the below-2-ids branch. reviews.service.js guards this exact gap
    // after the same resolveInterestSides call, for the same reason.
    return null;
  }
  const participantIds = [...new Set([accountHolderId(fromUser), accountHolderId(toUser)])];

  if (participantIds.length < 2) {
    // Degenerate case (e.g. both sides resolve to the same parent account)
    // — self-interest is already blocked at creation time, so this
    // shouldn't happen in practice, but a conversation genuinely can't
    // exist with one participant.
    return null;
  }

  try {
    return await Conversation.create({ interestRequestId: interestRequest._id, participantIds });
  } catch (err) {
    if (err.code === 11000) {
      return Conversation.findOne({ interestRequestId: interestRequest._id });
    }
    throw err;
  }
};

/**
 * Throws 404 (unknown conversation) or 403 (not one of its two
 * participants) — shared by every read/write path below, REST and socket
 * alike, so access control can't drift between the two.
 */
const assertParticipant = async (conversationId, requesterId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new ApiError(404, "Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  if (!conversation.participantIds.some((id) => String(id) === String(requesterId))) {
    throw new ApiError(403, "You are not a participant in this conversation.", "FORBIDDEN");
  }
  return conversation;
};

/**
 * GET /api/chat/conversations. A parent's own account IS the
 * participantId directly (accountHolderId already resolved this at
 * creation time) — unlike interests/listings/notifications, there's no
 * linked-children id list to also search here.
 */
export const getMyConversations = (requesterId) =>
  Conversation.find({ participantIds: requesterId }).sort({ lastMessageAt: -1, createdAt: -1 });

/**
 * GET /api/chat/conversations/:id/messages. Paginated newest-first (so
 * "page 1" is the most recent history, the natural default for opening a
 * chat), then reversed within the page so what's returned reads
 * chronologically top-to-bottom — the shape a chat UI actually wants to
 * render.
 */
export const getConversationMessages = async ({ conversationId, requesterId, page = 1, limit = 30 }) => {
  await assertParticipant(conversationId, requesterId);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 30));
  const skip = (pageNum - 1) * limitNum;

  const [messages, total] = await Promise.all([
    Message.find({ conversationId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    Message.countDocuments({ conversationId }),
  ]);

  return { messages: messages.reverse(), pagination: { page: pageNum, limit: limitNum, total } };
};

/**
 * Used only by sockets/chatSocket.js's send_message handler — the one path
 * that ever creates a Message (no REST POST for this, per the roadmap's
 * "WebSockets now justified by this feature specifically").
 */
export const createMessage = async ({ conversationId, senderId, text }) => {
  const conversation = await assertParticipant(conversationId, senderId);
  const message = await Message.create({ conversationId, senderId, text });
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  return message;
};
