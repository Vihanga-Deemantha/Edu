import Report from "../../models/Report.js";

/**
 * POST /api/reports. No existence-check on targetId against its own
 * collection (review/listing/user) — Phase 14, the only consumer of this
 * collection so far, tolerates a report pointing at something already
 * deleted by the time it's reviewed, same as any moderation queue would.
 */
export const createReport = async ({ reporterId, targetType, targetId, reason }) =>
  Report.create({ reporterId, targetType, targetId, reason });
