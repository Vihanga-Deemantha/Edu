import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Avatar, ErrorState, PageLoader, StatusBadge, Stars } from "../components/ui/index.jsx";
import ExpressInterestModal from "../components/ExpressInterestModal.jsx";
import AvailabilityWeek from "../components/AvailabilityWeek.jsx";
import ReviewsList from "../components/ReviewsList.jsx";
import ReportModal from "../components/ReportModal.jsx";
import Icon from "../components/ui/Icon.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { useLanguage } from "../context/languageContext.js";
import { availabilityApi, interestsApi, listingsApi, profilesApi } from "../api/endpoints.js";
import { apiErrorCode, classTypeLabel, curriculumLabel, firstName, formatPrice, mediumLabel, relativeTime } from "../lib/format.js";

const Fact = ({ label, children }) => (
  <div className="card flex flex-col gap-1.5 rounded-[14px] px-5 py-[18px]">
    <span className="text-xs font-bold tracking-[.1em] text-ink-2">{label}</span>
    <span className="text-[15px] leading-relaxed">{children}</span>
  </div>
);

const ListingDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const { localized, current } = useLanguage();
  const [interestOpen, setInterestOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const { data, loading, error } = useAsync(() => listingsApi.get(id), [id]);
  const listing = data?.listing;
  const isTeacherAd = listing?.type === "teacher_ad";
  const ownerId = listing?.ownerId;

  const { data: profileData } = useAsync(
    () => profilesApi.getTeacher(ownerId).catch(() => null),
    [ownerId],
    { enabled: Boolean(isTeacherAd && ownerId) }
  );
  const { data: availData } = useAsync(() => availabilityApi.forTeacher(ownerId), [ownerId], { enabled: Boolean(isTeacherAd && ownerId) });

  // The viewer's existing request on this listing (pending/accepted) replaces the CTA.
  const signedIn = status === "authenticated" && user?.role !== "admin";
  const { data: sentData, setData: setSent } = useAsync(() => interestsApi.sent({ limit: 50 }), [id, signedIn], { enabled: signedIn });
  const existing = sentData?.interests?.find((i) => String(i.listingId) === String(id) && ["pending", "accepted"].includes(i.status));

  if (loading) return <PageLoader />;
  if (error || !listing) {
    return (
      <ErrorState
        title={apiErrorCode(error) === "LISTING_NOT_FOUND" || error?.response?.status === 404 ? "This listing isn't available" : "We couldn't load this listing"}
        action={<Link to="/browse" className="btn btn-primary mt-2">Browse other classes</Link>}
      >
        It may have been closed by its owner, or it isn't visible to your account.
      </ErrorState>
    );
  }

  const owner = listing.owner || {};
  const profile = profileData?.profile;
  const description = localized(listing, "description");
  const isOwn = user && (String(owner._id) === String(user._id) || (user.linkedChildIds || []).some((c) => String(c._id) === String(ownerId)));
  const canInterest = !isOwn && (isTeacherAd ? ["student", "parent"].includes(user?.role) : user?.role === "teacher");
  const ownerFirst = firstName(owner.name);
  const coords = listing.location?.coordinates;

  const cta = () => {
    if (status !== "authenticated") {
      navigate("/login", { state: { from: { pathname: `/listings/${id}` } } });
      return;
    }
    setInterestOpen(true);
  };

  return (
    <div className="shell-narrow flex flex-col gap-7 pb-24 pt-7">
      <nav className="flex flex-wrap gap-2 text-sm text-ink-2" aria-label="Breadcrumb">
        <Link to="/browse">Browse</Link>
        <span>/</span>
        <Link to={`/browse?subject=${encodeURIComponent(listing.subject)}`}>{listing.subject}</Link>
        <span>/</span>
        <span className="text-ink">{listing.subject}{owner.name ? ` with ${owner.name}` : ""}</span>
      </nav>

      <div className="flex flex-wrap items-start gap-10">
        <div className="flex min-w-0 flex-col gap-10" style={{ flex: "999 1 560px" }}>
          <section className="flex flex-col gap-[18px]">
            <div className="flex flex-wrap gap-2">
              {[listing.subject, listing.grade, `${mediumLabel(listing.medium)} medium`, listing.curriculum && curriculumLabel(listing.curriculum)]
                .filter(Boolean)
                .map((t) => <span key={t} className="tag px-3 py-[5px] text-[13px] font-semibold">{t}</span>)}
              {listing.status !== "active" && <StatusBadge status={listing.status} />}
              {!isTeacherAd && <span className="status status-outline">Wanted ad</span>}
            </div>
            <h1 style={{ font: "400 clamp(34px,4vw,52px)/1.06 var(--font-display)", letterSpacing: "-.015em", textWrap: "balance" }}>
              {isTeacherAd ? `${listing.subject} — ${listing.grade}` : `Looking for a ${listing.subject} teacher`}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-ink-2">
              {isTeacherAd &&
                (owner.reviewCount > 0 ? (
                  <span className="flex items-center gap-1.5">
                    <Stars value={owner.avgRating} /> <b className="text-ink">{Number(owner.avgRating).toFixed(1)}</b> ({owner.reviewCount} reviews)
                  </span>
                ) : (
                  <span>No reviews yet</span>
                ))}
              <span>Posted {relativeTime(listing.createdAt)}</span>
            </div>
          </section>

          {isTeacherAd && (
            <section className="card flex flex-wrap items-center gap-[18px] p-[22px]">
              <Avatar name={owner.name} src={owner.photoUrl || profile?.photoUrl} size={84} />
              <div className="flex flex-col gap-1.5" style={{ flex: "1 1 240px" }}>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="serif text-2xl font-bold">{owner.name}</span>
                  {owner.verificationStatus === "fully_verified" && (
                    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary py-1 pl-[5px] pr-2.5 text-xs font-semibold text-white">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-primary">✓</span>Fully verified
                    </span>
                  )}
                  {owner.verificationStatus === "id_verified" && <span className="status status-outline">✓ ID verified</span>}
                </div>
                <span className="text-sm leading-normal text-ink-2">
                  {[profile?.qualifications?.[0], profile?.experienceYears ? `${profile.experienceYears} years teaching` : null].filter(Boolean).join(" · ") || "EduLink teacher"}
                </span>
              </div>
              <Link to={`/teachers/${owner._id}`} className="btn btn-outline btn-sm whitespace-nowrap">View full profile</Link>
            </section>
          )}

          <section className="flex flex-col gap-3.5">
            <h2 className="serif text-[30px]">{isTeacherAd ? "About this class" : "What they're looking for"}</h2>
            {description.fallback && (
              <span className="self-start rounded-full bg-mist px-3 py-1 text-xs font-semibold text-primary">
                Not available in {current.label} — showing the original
              </span>
            )}
            {description.text.split(/\n{2,}/).map((p, i) => (
              <p key={i} className="serif whitespace-pre-line text-lg leading-[1.65]" style={{ color: "#2A3163", textWrap: "pretty" }}>{p}</p>
            ))}
          </section>

          <section className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <Fact label="SCHEDULE">{listing.schedule?.length ? listing.schedule.map((s) => <span key={s} className="block">{s}</span>) : "Flexible — ask when you get in touch"}</Fact>
            {isTeacherAd && profile?.classType?.length > 0 && (
              <Fact label="CLASS TYPE">{profile.classType.map((c) => <span key={c} className="block">{classTypeLabel(c)}</span>)}</Fact>
            )}
            <Fact label="LEVEL">{listing.grade}{listing.curriculum ? <span className="block">{curriculumLabel(listing.curriculum)}</span> : null}</Fact>
          </section>

          {isTeacherAd && (
            <section className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                <h2 className="serif text-[30px]">Weekly availability</h2>
                <span className="text-[13px] text-ink-2">Booking opens after your interest is accepted</span>
              </div>
              {availData?.availability?.length ? (
                <AvailabilityWeek windows={availData.availability} />
              ) : (
                <div className="card px-6 py-6 text-sm text-ink-2">{ownerFirst || "This teacher"} hasn't published weekly availability yet.</div>
              )}
            </section>
          )}

          {coords && (
            <section className="flex flex-col gap-3.5">
              <h2 className="serif text-[30px]">Where classes happen</h2>
              <div className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-2xl" style={{ background: "repeating-linear-gradient(135deg, var(--line-soft) 0 12px, var(--mist) 12px 24px)" }}>
                <a
                  className="btn btn-light"
                  target="_blank"
                  rel="noreferrer"
                  // Rounded to ~1 km so only the approximate area is shown.
                  href={`https://www.google.com/maps/search/?api=1&query=${coords[1].toFixed(2)},${coords[0].toFixed(2)}`}
                >
                  <Icon name="pin" size={18} /> View approximate area
                </a>
              </div>
              <span className="text-[13px] text-ink-2">Exact address is shared once your interest is accepted.</span>
            </section>
          )}

          {isTeacherAd && <ReviewsList teacherId={owner._id} avgRating={owner.avgRating} reviewCount={owner.reviewCount} />}
        </div>

        <aside className="sticky top-24 flex flex-col gap-3.5" style={{ flex: "1 1 320px", maxWidth: 380 }}>
          <div className="card flex flex-col gap-[18px] rounded-[18px] p-[26px]" style={{ boxShadow: "0 24px 50px -30px rgba(22,27,63,.35)" }}>
            {listing.price?.amount !== undefined ? (
              <div className="flex items-baseline gap-2">
                <span className="serif text-[40px] leading-none">{formatPrice(listing.price, { unit: false })}</span>
                <span className="text-[15px] text-ink-2">/ {listing.price.unit === "month" ? "month" : "hour"}</span>
              </div>
            ) : (
              <span className="serif text-3xl">{isTeacherAd ? "Fee on request" : "Budget open"}</span>
            )}

            {isOwn ? (
              <div className="flex flex-col gap-2.5 rounded-xl bg-mist p-4">
                <span className="text-[15px] font-bold">This is your listing</span>
                <Link to={`/listings/${listing._id}/edit`} className="btn btn-primary">Edit listing</Link>
              </div>
            ) : existing ? (
              <div className="flex flex-col gap-2.5 rounded-xl bg-mist p-4">
                <span className="flex items-center gap-2 text-[15px] font-bold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: existing.status === "accepted" ? "var(--primary)" : "var(--blue)" }} />
                  {existing.status === "accepted" ? "Interest accepted" : "Interest sent"}
                </span>
                <span className="text-sm leading-normal text-ink-2">
                  {existing.status === "accepted"
                    ? `${ownerFirst || "They"} accepted. You can chat and book a trial class.`
                    : `Awaiting ${ownerFirst ? `${ownerFirst}'s` : "their"} response. We'll notify you as soon as they reply.`}
                </span>
                {existing.status === "accepted" && existing.conversationId ? (
                  <Link to={`/chat/${existing.conversationId}`} className="text-sm font-semibold">Go to chat →</Link>
                ) : (
                  <Link to="/interests?tab=sent" className="text-sm font-semibold">View in Interests →</Link>
                )}
              </div>
            ) : listing.status !== "active" ? (
              <span className="text-sm text-ink-2">This listing isn't accepting new interest.</span>
            ) : status !== "authenticated" || canInterest ? (
              <>
                <button type="button" className="btn btn-primary h-[52px] rounded-[10px] text-base" onClick={cta}>
                  {status === "authenticated" ? "Express interest" : "Sign in to express interest"}
                </button>
                <span className="text-center text-[13px] leading-normal text-ink-2">
                  Free to send. {ownerFirst || "The owner"} will see your message and can accept or decline.
                </span>
              </>
            ) : (
              <span className="text-sm text-ink-2">
                {isTeacherAd ? "Only students and parents can express interest in a class." : "Only teachers can respond to a wanted ad."}
              </span>
            )}

            <div className="flex flex-col gap-2.5 border-t border-mist pt-4 text-sm">
              {isTeacherAd && owner.verificationStatus === "fully_verified" && <span className="flex gap-2.5"><b className="text-primary">✓</b>ID and police clearance verified</span>}
              {isTeacherAd && owner.verificationStatus === "id_verified" && <span className="flex gap-2.5"><b className="text-primary">✓</b>Identity document verified</span>}
              <span className="flex gap-2.5"><b className="text-primary">✓</b>All messages stay on EduLink</span>
              <span className="flex gap-2.5"><b className="text-primary">✓</b>Contact details shared only after acceptance</span>
            </div>
          </div>
          {status === "authenticated" && !isOwn && (
            <button type="button" onClick={() => setReportOpen(true)} className="self-end border-0 bg-transparent px-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
              Report listing
            </button>
          )}
        </aside>
      </div>

      <ExpressInterestModal
        open={interestOpen}
        onClose={() => setInterestOpen(false)}
        listing={listing}
        ownerName={owner.name}
        onSent={(interest) => setSent((d) => ({ ...(d || {}), interests: [interest, ...(d?.interests || [])] }))}
      />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} targetType="listing" targetId={listing._id} targetLabel={`${listing.subject} · ${listing.grade}`} />
    </div>
  );
};

export default ListingDetailPage;
