import TeacherAvailability from "../../models/TeacherAvailability.js";
import ApiError from "../../utils/ApiError.js";

/** POST /api/availability (teacher only) — declare a recurring weekly window. */
export const createAvailability = ({ teacherId, dayOfWeek, startTime, endTime }) =>
  TeacherAvailability.create({ teacherId, dayOfWeek, startTime, endTime });

/**
 * GET /api/availability/:teacherId — public, same visibility as a public
 * profile/review read (Phase 2/11B); a teacher's bookable hours aren't
 * sensitive the way a student_ad or a child's identity is.
 */
export const getTeacherAvailability = (teacherId) =>
  TeacherAvailability.find({ teacherId }).sort({ dayOfWeek: 1, startTime: 1 });

/** DELETE /api/availability/:id (teacher only, own). */
export const deleteAvailability = async ({ availabilityId, teacherId }) => {
  const window = await TeacherAvailability.findById(availabilityId);
  if (!window) {
    throw new ApiError(404, "Availability window not found", "AVAILABILITY_NOT_FOUND");
  }
  if (String(window.teacherId) !== String(teacherId)) {
    throw new ApiError(403, "You do not have permission to modify this availability window.", "FORBIDDEN");
  }
  await window.deleteOne();
};
