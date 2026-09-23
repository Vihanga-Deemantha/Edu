import mongoose from "mongoose";

/**
 * Message — always written server-side from an authenticated socket
 * connection (see sockets/chatSocket.js), never via a REST POST; the REST
 * side of Phase 13B only reads (conversation list + history).
 */
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      immutable: true,
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Matches chat.service.js's history query exactly: one conversation's
// messages, newest first for pagination.
messageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;
