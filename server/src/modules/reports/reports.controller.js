import * as reportsService from "./reports.service.js";

// ─── POST /api/reports  (protected) ──────────────────────────────────────────
export const createReport = async (req, res, next) => {
  try {
    const report = await reportsService.createReport({ reporterId: req.user.id, ...req.body });
    res.status(201).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
};
