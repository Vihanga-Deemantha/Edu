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
