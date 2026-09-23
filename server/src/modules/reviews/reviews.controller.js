import * as reviewsService from "./reviews.service.js";
import { enqueueNotificationJob } from "../../queues/notification.queue.js";

// ─── POST /api/reviews  (protected) ──────────────────────────────────────────
export const createReview = async (req, res, next) => {
  try {
    const review = await reviewsService.createReview({
      requesterId: req.user.id,
      requesterRole: req.user.role,
      ...req.body,
    });

    enqueueNotificationJob({
      userId: review.teacherId,
      type: "new_review",
      payload: { rating: review.rating },
    });

    res.status(201).json({ success: true, data: { review } });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/reviews/teacher/:teacherId  (public) ───────────────────────────
export const getTeacherReviews = async (req, res, next) => {
  try {
    const { reviews, pagination } = await reviewsService.getTeacherReviews(req.params.teacherId, req.query);
    res.status(200).json({ success: true, data: { reviews, pagination } });
  } catch (err) {
    next(err);
  }
};
