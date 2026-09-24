import { EventEmitter } from "events";

/**
 * A tiny in-process event bus for cross-module reactions that need to happen
 * immediately, in this same process — distinct from queues/notification.queue.js's
 * BullMQ jobs, which are for durable, eventually-processed, possibly-cross-process
 * work. Right now the one subscriber is sockets/chatSocket.js, reacting to a
 * user being suspended — kept deliberately generic (not chat-specific) rather
 * than importing Socket.io concerns into admin.service.js, so admin.service.js
 * doesn't need to know Socket.io exists at all, just that a user was suspended.
 */
export const userEvents = new EventEmitter();

export const USER_SUSPENDED = "user:suspended";
