import * as chatService from "./chat.service.js";

// ─── GET /api/chat/conversations  (protected) ────────────────────────────────
export const getMyConversations = async (req, res, next) => {
  try {
    const conversations = await chatService.getMyConversations(req.user.id);
    res.status(200).json({ success: true, data: { conversations } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/chat/conversations/:id/messages  (protected, participant only) ─
export const getConversationMessages = async (req, res, next) => {
  try {
    const { messages, pagination } = await chatService.getConversationMessages({
      conversationId: req.params.id,
      requesterId: req.user.id,
      ...req.query,
    });
    res.status(200).json({ success: true, data: { messages, pagination } });
  } catch (err) {
    next(err);
  }
};
