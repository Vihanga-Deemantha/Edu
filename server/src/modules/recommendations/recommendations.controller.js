import * as recommendationsService from "./recommendations.service.js";

// Request validation happens in the `validate` route middleware
// (server/src/middleware/validate.js).

// ─── GET /api/recommendations/teachers  (protected: student, parent) ────────
export const recommendTeachers = async (req, res, next) => {
  try {
    const recommendations = await recommendationsService.recommendTeachersForStudent({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      targetUserId: req.query.targetUserId,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data: { recommendations } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/recommendations/students  (protected: teacher) ────────────────
export const recommendStudents = async (req, res, next) => {
  try {
    const recommendations = await recommendationsService.recommendStudentsForTeacher({
      requesterId: req.user.id,
      limit: req.query.limit,
    });
    res.status(200).json({ success: true, data: { recommendations } });
  } catch (err) {
    next(err);
  }
};
