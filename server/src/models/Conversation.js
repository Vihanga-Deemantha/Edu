import mongoose from "mongoose";

/**
 * Conversation — created automatically the moment an InterestRequest is
 * accepted (see interests.controller.js), replacing raw contact-detail
 * exposure with an in-app thread. One per accepted interest, enforced by
 * the unique index below.
 *
 * participantIds always holds the real, session-holding account on each
 * side — a child-linked party's PARENT, never the child directly (the
 * roadmap's explicit "the parent is always a participant, the child is not
 * a direct party" rule; see utils/familyAccess.js's accountHolderId, which
 * this is resolved through at creation time). Everything downstream (socket
 * auth, message access control) just checks direct membership in this
 * array — the parent-vs-child resolution happens exactly once, here.
 */
const conversationSchema = new mongoose.Schema(
  {
    interestRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InterestRequest",
      required: true,
      unique: true,
      immutable: true,
    },
    participantIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      immutable: true,
      validate: {
        validator: (arr) => arr.length === 2,
        message: "A conversation must have exactly two participants",
      },
    },
    // Denormalized for sorting a conversation list newest-active-first
    // without a $lookup into Message on every read.
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationSchema.index({ participantIds: 1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
