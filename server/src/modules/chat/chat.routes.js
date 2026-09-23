import { Router } from "express";
import * as chatController from "./chat.controller.js";
import { conversationIdParamValidation, listMessagesValidation } from "./chat.validation.js";
import authenticate from "../../middleware/authenticate.js";
import validate from "../../middleware/validate.js";

const router = Router();

/**
 * GET /api/chat/conversations
 * Protected — the caller's own conversations (their own account is always
 * the participantId directly, even for a child-linked one; see
 * chat.service.js).
 */
router.get("/conversations", authenticate, chatController.getMyConversations);

/**
 * GET /api/chat/conversations/:id/messages
 * Protected, participant only. Read-only REST side of chat — sending a
 * message only ever happens over the socket connection (sockets/chatSocket.js).
 */
router.get(
  "/conversations/:id/messages",
  authenticate,
  conversationIdParamValidation,
  listMessagesValidation,
  validate,
  chatController.getConversationMessages
);

export default router;
