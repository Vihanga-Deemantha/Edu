import User from "../models/User.js";

/**
 * The trust boundary established in Phase 0 (register-child) and reused
 * everywhere a parent acts on behalf of a linked child instead of the child
 * authenticating directly: true if `childUserId` is one of `parentUser`'s
 * linkedChildIds.
 */
export const isLinkedChild = (parentUser, childUserId) =>
  (parentUser?.linkedChildIds || []).some((id) => String(id) === String(childUserId));

/**
 * Convenience wrapper for the common case: load the requester and check in
 * one call. Returns false (not a throw) for a non-parent or missing user —
 * callers decide what "not allowed" means for their own endpoint.
 */
export const isRequesterParentOf = async (requesterId, childUserId) => {
  const parent = await User.findById(requesterId);
  return isLinkedChild(parent, childUserId);
};

/**
 * "My own records, plus every linked child's" — the id list a parent's own
 * data (listings, interest requests, notifications, ...) is scoped to,
 * since a child never authenticates and so never queries anything under
 * their own id directly. For a non-parent, this is just [requesterId].
 * Extracted here once it was about to be copy-pasted a third time
 * (listings.service.js's getMyListings had it inline first).
 */
export const resolveOwnedUserIds = async (requesterId, requesterRole) => {
  const ids = [String(requesterId)];
  if (requesterRole === "parent") {
    const parent = await User.findById(requesterId);
    for (const childId of parent?.linkedChildIds || []) {
      ids.push(String(childId));
    }
  }
  return ids;
};

/**
 * The real, session-holding account behind a user document — the parent's
 * own id if this user is a child-linked account (who never authenticates
 * directly, per the Phase 0 decision), otherwise the user's own id. Takes
 * an already-loaded user document, not an id, since every call site so far
 * already has one in hand (interests.service.js's contact-reveal resolves
 * the same way but needs the parent's full record, not just their id — see
 * resolveContact there — so this doesn't replace that, it's the narrower
 * "just the id" version Phase 13B's chat participancy needs).
 */
export const accountHolderId = (user) => String(user.parentId || user._id);
