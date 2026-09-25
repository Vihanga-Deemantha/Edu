import { useState } from "react";
import { Stars } from "./ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import { reviewsApi } from "../api/endpoints.js";
import { formatDate } from "../lib/format.js";

const PAGE = 5;

/**
 * Paginated reviews for a teacher (spec §4.2 / §9.2). Reviewer identity is
 * never shown — the backend doesn't expose it, by design.
 */
const ReviewsList = ({ teacherId, avgRating = 0, reviewCount = 0, title = "Reviews" }) => {
  const [pages, setPages] = useState(1);
  const { data, loading } = useAsync(() => reviewsApi.forTeacher(teacherId, { page: 1, limit: PAGE * pages }), [teacherId, pages]);
  const reviews = data?.reviews || [];
  const total = data?.pagination?.total ?? reviewCount;

  return (
    <section className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="serif text-[30px]">{title}</h2>
        {reviewCount > 0 && (
          <div className="flex items-baseline gap-2.5">
            <span className="serif text-[40px] leading-none">{Number(avgRating).toFixed(1)}</span>
            <Stars value={avgRating} size={16} />
            <span className="text-sm text-ink-2">{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
          </div>
        )}
      </div>
      {!loading && reviews.length === 0 ? (
        <div className="card px-6 py-8 text-center text-[15px] text-ink-2">
          No reviews yet. Reviews come only from students who completed a class.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r._id} className="card flex flex-col gap-2 rounded-[14px] px-[22px] py-5">
              <div className="flex flex-wrap justify-between gap-2.5">
                <Stars value={r.rating} />
                <span className="text-[13px] text-ink-2">Verified student · {formatDate(r.createdAt, { month: "long", year: "numeric" })}</span>
              </div>
              {r.comment && <span className="serif text-[17px] leading-relaxed">{r.comment}</span>}
            </div>
          ))}
        </div>
      )}
      {reviews.length < total && (
        <button type="button" className="btn btn-outline self-start" disabled={loading} onClick={() => setPages((p) => p + 1)}>
          {loading ? "Loading…" : "Show more reviews"}
        </button>
      )}
    </section>
  );
};

export default ReviewsList;
