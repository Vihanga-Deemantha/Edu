import * as availabilityService from "./availability.service.js";

// ─── POST /api/availability  (protected, teacher only) ──────────────────────
export const createAvailability = async (req, res, next) => {
  try {
    const availability = await availabilityService.createAvailability({
      teacherId: req.user.id,
      ...req.body,
    });
    res.status(201).json({ success: true, data: { availability } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/availability/:teacherId  (public) ──────────────────────────────
export const getTeacherAvailability = async (req, res, next) => {
  try {
    const availability = await availabilityService.getTeacherAvailability(req.params.teacherId);
    res.status(200).json({ success: true, data: { availability } });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/availability/:id  (protected, teacher only, own) ───────────
export const deleteAvailability = async (req, res, next) => {
  try {
    await availabilityService.deleteAvailability({ availabilityId: req.params.id, teacherId: req.user.id });
    res.status(200).json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
};
