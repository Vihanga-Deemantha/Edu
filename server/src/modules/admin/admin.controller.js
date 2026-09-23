import * as adminService from "./admin.service.js";

// ─── PATCH /api/admin/verification/:userId ───────────────────────────────────
export const reviewVerification = async (req, res, next) => {
  try {
    const verification = await adminService.reviewVerification({
      adminId: req.user.id,
      userId: req.params.userId,
      ...req.body,
    });
    res.status(200).json({ success: true, data: { verification } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/admin/users/:userId/suspend ──────────────────────────────────
export const suspendUser = async (req, res, next) => {
  try {
    const user = await adminService.suspendUser({
      adminId: req.user.id,
      userId: req.params.userId,
      adminNotes: req.body.adminNotes,
    });
    res.status(200).json({ success: true, data: { user: { id: user._id, isActive: user.isActive } } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/admin/listings/:id/moderate ──────────────────────────────────
export const moderateListing = async (req, res, next) => {
  try {
    const listing = await adminService.moderateListing({
      adminId: req.user.id,
      listingId: req.params.id,
      status: req.body.status,
      adminNotes: req.body.adminNotes,
    });
    res.status(200).json({ success: true, data: { listing } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/admin/reports ───────────────────────────────────────────────────
export const getReports = async (req, res, next) => {
  try {
    const { reports, pagination } = await adminService.getReports(req.query);
    res.status(200).json({ success: true, data: { reports, pagination } });
  } catch (err) {
    next(err);
  }
};

// ─── PATCH /api/admin/reports/:id/resolve ────────────────────────────────────
export const resolveReport = async (req, res, next) => {
  try {
    const report = await adminService.resolveReport({
      adminId: req.user.id,
      reportId: req.params.id,
      status: req.body.status,
      adminNotes: req.body.adminNotes,
    });
    res.status(200).json({ success: true, data: { report } });
  } catch (err) {
    next(err);
  }
};
