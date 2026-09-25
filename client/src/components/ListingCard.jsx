import { Link } from "react-router-dom";
import { Avatar, RatingLine, VerifiedBadge } from "./ui/index.jsx";
import { curriculumLabel, formatPrice, mediumLabel } from "../lib/format.js";

const km = (meters) => (meters === undefined || meters === null ? null : `${(meters / 1000).toFixed(1)} km`);

/**
 * The listing card used by Browse, recommendations and profile pages. A
 * teacher_ad leads with the teacher (photo, name, verified badge, rating); a
 * student_ad (only ever shown to teachers) leads with the wanted subject.
 * `why` is only rendered when the backend supplied a real match reason.
 */
const ListingCard = ({ listing, why }) => {
  const owner = listing.owner || {};
  const isTeacherAd = listing.type === "teacher_ad";
  const distance = km(listing.distanceMeters);

  return (
    <Link to={`/listings/${listing._id}`} className="card card-hover flex flex-col gap-3 p-5 text-ink hover:text-ink">
      {isTeacherAd ? (
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} src={owner.photoUrl} size={52} />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="serif truncate text-lg font-bold">{owner.name || "Teacher"}</span>
            {owner.verificationStatus && owner.verificationStatus !== "none" ? (
              <VerifiedBadge tier={owner.verificationStatus} />
            ) : (
              <span className="text-xs font-semibold text-ink-2">Not yet verified</span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="serif flex h-[52px] w-[52px] flex-none items-center justify-center rounded-xl bg-mist text-2xl font-bold italic text-primary">
            {listing.subject?.[0]}
          </span>
          <div className="flex min-w-0 flex-col gap-[3px]">
            <span className="eyebrow text-[11px]">Wanted</span>
            <span className="serif truncate text-lg font-bold">
              {owner.name ? `${owner.name}${owner.isChild ? " (child account)" : ""}` : "A student"}
            </span>
          </div>
        </div>
      )}
      <span className="text-[15px] font-semibold">
        {listing.subject} · {listing.grade}
      </span>
      <div className="flex flex-wrap gap-1.5">
        <span className="tag">{mediumLabel(listing.medium)} medium</span>
        {listing.curriculum && <span className="tag">{curriculumLabel(listing.curriculum)}</span>}
        {listing.schedule?.[0] && <span className="tag">{listing.schedule[0]}</span>}
      </div>
      {why && (
        <span className="border-l-2 border-blue pl-2.5 text-[13px] leading-snug text-primary">{why}</span>
      )}
      {isTeacherAd && <RatingLine avgRating={owner.avgRating} reviewCount={owner.reviewCount} extra={distance} />}
      {!isTeacherAd && distance && <span className="text-[13px] text-ink-2">{distance} away</span>}
      <div className="mt-auto flex items-center justify-between border-t border-mist pt-3">
        <span className="serif text-xl">{formatPrice(listing.price) || (isTeacherAd ? "Ask for fee" : "Budget open")}</span>
        <span className="text-sm font-semibold text-primary">View →</span>
      </div>
    </Link>
  );
};

export const ListingCardSkeleton = () => (
  <div className="card flex flex-col gap-3.5 p-5" aria-hidden="true">
    <div className="flex items-center gap-3">
      <div className="skeleton h-[52px] w-[52px] rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="skeleton h-3.5 w-3/4" />
        <div className="skeleton h-2.5 w-2/5" />
      </div>
    </div>
    <div className="skeleton h-3 w-5/6" />
    <div className="flex gap-1.5">
      <div className="skeleton h-[22px] w-20 rounded-full" />
      <div className="skeleton h-[22px] w-16 rounded-full" />
    </div>
    <div className="h-px bg-mist" />
    <div className="skeleton h-4 w-1/2" />
  </div>
);

export default ListingCard;
