import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorState, PageLoader, Stars } from "../components/ui/index.jsx";
import ExpressInterestModal from "../components/ExpressInterestModal.jsx";
import ReviewsList from "../components/ReviewsList.jsx";
import ReportModal from "../components/ReportModal.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { useLanguage } from "../context/languageContext.js";
import { availabilityApi, interestsApi, listingsApi, profilesApi } from "../api/endpoints.js";
import { toLocalWindows } from "../lib/time.js";
import { DAYS_SHORT, classTypeLabel, curriculumLabel, firstName, formatClock, formatDate, formatPrice, mediumLabel } from "../lib/format.js";

const ROWS = [
  ["Morning", 6, 12],
  ["Afternoon", 12, 17],
  ["Evening", 17, 21],
  ["Night", 21, 24],
];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const toHour = (t) => Number(t.split(":")[0]) + Number(t.split(":")[1]) / 60;

const AvailabilityGrid = ({ windows }) => (
  <div className="card overflow-x-auto p-5">
    <div className="grid min-w-[620px] gap-1.5" style={{ gridTemplateColumns: "90px repeat(7, minmax(64px, 1fr))" }}>
      <span />
      {ORDER.map((d) => <span key={d} className="pb-1 text-center text-[13px] font-bold text-ink-2">{DAYS_SHORT[d]}</span>)}
      {ROWS.map(([label, from, to]) => (
        <div key={label} className="contents">
          <span className="flex items-center text-[13px] text-ink-2">{label}</span>
          {ORDER.map((d) => {
            const hits = windows.filter((w) => w.dayOfWeek === d && toHour(w.startTime) < to && toHour(w.endTime) > from);
            return (
              <div
                key={d}
                title={hits.map((w) => `${formatClock(w.startTime)} – ${formatClock(w.endTime)}`).join(", ") || undefined}
                className="flex h-10 items-center justify-center rounded-lg text-xs font-semibold text-white"
                style={{ background: hits.length ? "var(--primary)" : "var(--line-soft)" }}
              >
                {hits.length ? "Free" : ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
    <div className="mt-3.5 flex flex-wrap gap-[18px] text-[13px] text-ink-2">
      <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded bg-primary" />Generally free</span>
      <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 rounded border border-line bg-line-soft" />Not available</span>
    </div>
  </div>
);

const TeacherProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, status } = useAuth();
  const { localized, current } = useLanguage();
  const [modal, setModal] = useState(false);
  const [report, setReport] = useState(false);

  const { data, loading, error } = useAsync(() => profilesApi.getTeacher(userId), [userId]);
  const { data: listingData } = useAsync(() => listingsApi.browse({ ownerId: userId, limit: 50 }), [userId]);
  const { data: availData } = useAsync(() => availabilityApi.forTeacher(userId), [userId]);
  const signedIn = status === "authenticated" && ["student", "parent"].includes(user?.role);
  const { data: sentData } = useAsync(() => interestsApi.sent({ limit: 50 }), [signedIn], { enabled: signedIn });

  if (loading) return <PageLoader />;
  if (error || !data?.profile) {
    const own = user && String(user._id) === String(userId);
    return (
      <ErrorState
        title={own ? "You haven't built your profile yet" : "Teacher not found"}
        action={own ? <Link to="/profile/edit" className="btn btn-primary mt-2">Build your profile</Link> : <Link to="/browse" className="btn btn-primary mt-2">Browse teachers</Link>}
      >
        {own ? "Students see this page before they get in touch. Add your subjects, grades and a short bio." : "This teacher's profile doesn't exist or isn't public yet."}
      </ErrorState>
    );
  }

  const p = data.profile;
  const listings = listingData?.listings || [];
  const windows = toLocalWindows(availData?.availability || []);
  const isOwn = user && String(user._id) === String(userId);
  const first = firstName(p.name);
  const bio = localized(p, "bio");
  const tier = p.verificationStatus;
  const listingIds = new Set(listings.map((l) => String(l._id)));
  const pending = sentData?.interests?.find((i) => listingIds.has(String(i.listingId)) && i.status === "pending");
  const canInterest = !isOwn && (status !== "authenticated" || signedIn) && listings.length > 0;

  const openInterest = () => {
    if (status !== "authenticated") {
      navigate("/login", { state: { from: { pathname: `/teachers/${userId}` } } });
      return;
    }
    setModal(true);
  };

  const tags = [
    ...p.subjects,
    ...p.grades,
    ...p.medium.map((m) => `${mediumLabel(m)} medium`),
    ...(p.curriculum || []).map(curriculumLabel),
    ...p.classType.map(classTypeLabel),
  ];

  const ctaBlock = isOwn ? (
    <>
      <button type="button" disabled title="This is your own profile" className="btn btn-primary h-[52px] rounded-[10px] text-base">Express interest</button>
      <span className="text-center text-[13px] text-ink-2">You're viewing your own profile. <Link to="/profile/edit">Edit profile</Link></span>
    </>
  ) : pending ? (
    <div className="flex flex-col gap-1 rounded-[10px] border bg-white px-4 py-3.5" style={{ borderColor: "var(--lavender)" }}>
      <span className="flex items-center gap-2 text-[15px] font-bold"><span className="h-2.5 w-2.5 rounded-full bg-blue" />Interest sent</span>
      <span className="text-[13px] text-ink-2">Awaiting {first}'s response · <Link to="/interests?tab=sent">View</Link></span>
    </div>
  ) : canInterest ? (
    <button type="button" className="btn btn-primary h-[52px] rounded-[10px] text-base" onClick={openInterest}>
      {status === "authenticated" ? "Express interest" : "Sign in to express interest"}
    </button>
  ) : listings.length === 0 ? (
    <span className="rounded-[10px] bg-white px-4 py-3.5 text-center text-sm text-ink-2">{first} has no open classes right now.</span>
  ) : null;

  return (
    <>
      <section className="bg-mist">
        <div className="shell-narrow flex flex-col gap-7 pb-10 pt-7">
          <nav className="flex flex-wrap gap-2 text-sm text-ink-2" aria-label="Breadcrumb">
            <Link to="/browse">Browse</Link>
            {p.subjects[0] && (<><span>/</span><Link to={`/browse?subject=${encodeURIComponent(p.subjects[0])}`}>{p.subjects[0]}</Link></>)}
            <span>/</span>
            <span className="text-ink">{p.name}</span>
          </nav>
          <div className="flex flex-wrap items-start gap-8">
            <div className="flex-none overflow-hidden rounded-[20px]" style={{ width: 168, height: 168 }}>
              {p.photoUrl ? (
                <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="img-ph serif text-6xl font-bold">{(p.name || "?")[0]}</div>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3.5" style={{ flex: "1 1 380px" }}>
              <h1 style={{ font: "400 clamp(36px,4vw,52px)/1.04 var(--font-display)", letterSpacing: "-.015em" }}>{p.name}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[15px] text-ink-2">
                {p.reviewCount > 0 ? (
                  <span className="flex items-center gap-1.5"><Stars value={p.avgRating} /><b className="text-ink">{Number(p.avgRating).toFixed(1)}</b> ({p.reviewCount} reviews)</span>
                ) : (
                  <span>No reviews yet</span>
                )}
                {p.experienceYears > 0 && <span>{p.experienceYears} years teaching</span>}
                {p.memberSince && <span>On EduLink since {formatDate(p.memberSince, { month: "short", year: "numeric" })}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="whitespace-nowrap rounded-full border bg-white px-3 py-1.5 text-[13px] font-semibold text-primary" style={{ borderColor: "var(--lavender)" }}>{t}</span>
                ))}
              </div>
              {tier !== "none" && (
                <div className="flex max-w-[640px] items-start gap-3.5 rounded-[14px] border bg-white px-[18px] py-4" style={{ borderColor: "var(--lavender)" }}>
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary text-lg font-bold text-white">✓</span>
                  <div className="flex flex-col gap-1">
                    <span className="serif text-lg font-bold">{tier === "fully_verified" ? "Fully verified teacher" : "ID verified teacher"}</span>
                    <span className="text-sm leading-normal text-ink-2">
                      {tier === "fully_verified"
                        ? `EduLink has checked ${first}'s national ID, a selfie with the ID, and a police clearance report. Fully verified teachers can accept requests for child accounts.`
                        : `EduLink has checked ${first}'s national ID and a selfie with the ID. Requests for child accounts need full verification.`}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5" style={{ flex: "0 1 300px", minWidth: 260 }}>
              {ctaBlock}
              {status === "authenticated" && !isOwn && (
                <button type="button" onClick={() => setReport(true)} className="border-0 bg-transparent text-[13px] font-semibold text-ink-2 hover:text-ink">Report this teacher</button>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky z-30 border-b border-line" style={{ top: 80, background: "rgba(251,250,253,.96)", backdropFilter: "blur(8px)" }}>
        <nav className="shell-narrow flex gap-1 overflow-x-auto no-scrollbar" aria-label="Profile sections">
          {[["About", "#about"], ["Classes", "#classes"], ["Availability", "#availability"], ["Reviews", "#reviews"]].map(([label, href]) => (
            <a key={href} href={href} className="whitespace-nowrap border-b-2 border-transparent px-3.5 py-4 text-[15px] font-semibold text-ink hover:border-primary hover:text-primary">{label}</a>
          ))}
        </nav>
      </div>

      <div className="shell-narrow flex flex-col gap-14 pb-24 pt-10">
        <section id="about" className="flex flex-wrap gap-10" style={{ scrollMarginTop: 150 }}>
          <div className="flex min-w-0 flex-col gap-4" style={{ flex: "999 1 520px" }}>
            <h2 className="serif text-[34px]">About</h2>
            {bio.fallback && bio.text && (
              <div className="flex items-center gap-2.5 self-start rounded-[10px] bg-mist px-3.5 py-2.5 text-[13px]" style={{ color: "#2A3163" }}>
                <span className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-primary text-[11px] font-bold text-primary">i</span>
                Not available in {current.label}. Showing the original version.
              </div>
            )}
            {bio.text ? (
              bio.text.split(/\n{2,}/).map((para, i) => (
                <p key={i} className="serif whitespace-pre-line text-[19px] leading-[1.65]" style={{ color: "#2A3163", textWrap: "pretty" }}>{para}</p>
              ))
            ) : (
              <p className="text-[15px] text-ink-2">{first} hasn't written a bio yet.</p>
            )}
          </div>
          <div className="flex flex-col gap-3.5" style={{ flex: "1 1 300px" }}>
            {p.qualifications?.length > 0 && (
              <div className="card flex flex-col gap-4 p-[22px]">
                <span className="eyebrow-muted">Qualifications</span>
                {p.qualifications.map((q) => (
                  <div key={q} className="flex items-start gap-3">
                    <span className="mt-2 h-2 w-2 flex-none rounded-full bg-blue" />
                    <span className="text-[15px] font-semibold">{q}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="card rounded-[14px] p-[18px]"><div className="serif text-[32px] leading-none text-primary">{p.experienceYears || 0}</div><div className="mt-1.5 text-[13px] text-ink-2">Years teaching</div></div>
              <div className="card rounded-[14px] p-[18px]"><div className="serif text-[32px] leading-none text-primary">{listings.length}</div><div className="mt-1.5 text-[13px] text-ink-2">Active classes</div></div>
            </div>
          </div>
        </section>

        <section id="classes" className="flex flex-col gap-5" style={{ scrollMarginTop: 150 }}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="serif text-[34px]">Active classes</h2>
            <span className="text-sm text-ink-2">{listings.length} {listings.length === 1 ? "listing" : "listings"}</span>
          </div>
          {listings.length === 0 ? (
            <div className="card px-6 py-8 text-center text-[15px] text-ink-2">No open classes right now.</div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {listings.map((l) => (
                <Link key={l._id} to={`/listings/${l._id}`} className="card card-hover flex flex-col overflow-hidden text-ink hover:text-ink">
                  <div className="h-1 bg-blue" />
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <span className="serif text-xl font-bold leading-tight">{l.subject} — {l.grade}</span>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="tag">{mediumLabel(l.medium)} medium</span>
                      {l.curriculum && <span className="tag">{curriculumLabel(l.curriculum)}</span>}
                    </div>
                    {l.schedule?.length > 0 && <span className="text-sm text-ink-2">{l.schedule.join(" · ")}</span>}
                    <div className="mt-auto flex items-center justify-between border-t border-mist pt-3">
                      <span className="serif text-xl">{formatPrice(l.price) || "Fee on request"}</span>
                      <span className="text-sm font-semibold text-primary">View →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section id="availability" className="flex flex-col gap-4" style={{ scrollMarginTop: 150 }}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="serif text-[34px]">Weekly availability</h2>
            <span className="text-sm text-ink-2">Booking opens once your interest is accepted</span>
          </div>
          {windows.length ? <AvailabilityGrid windows={windows} /> : <div className="card px-6 py-6 text-sm text-ink-2">{first} hasn't published weekly availability yet.</div>}
        </section>

        <section id="reviews" style={{ scrollMarginTop: 150 }}>
          <ReviewsList teacherId={userId} avgRating={p.avgRating} reviewCount={p.reviewCount} />
          <p className="mt-3 text-[13px] text-ink-2">Only students who completed a class can review. Reviewer names are kept private.</p>
        </section>

        {!isOwn && canInterest && (
          <section className="card-dark flex flex-wrap items-center justify-between gap-6 rounded-[20px] p-9">
            <div className="flex max-w-[560px] flex-col gap-2">
              <span className="serif text-[32px] leading-tight">Ready to learn with {first}?</span>
              <span className="flex items-center gap-2 text-[15px] text-on-dark">
                {p.reviewCount > 0 ? `${Number(p.avgRating).toFixed(1)} from ${p.reviewCount} students` : "New on EduLink"}
                {tier === "fully_verified" ? " · Fully verified" : tier === "id_verified" ? " · ID verified" : ""}
              </span>
            </div>
            {pending ? (
              <span className="rounded-[10px] border-[1.5px] border-blue px-[22px] py-3.5 text-[15px] font-semibold">Interest sent · awaiting response</span>
            ) : (
              <button type="button" className="btn btn-light btn-lg" onClick={openInterest}>Express interest</button>
            )}
          </section>
        )}
      </div>

      <ExpressInterestModal open={modal} onClose={() => setModal(false)} listings={listings} ownerName={p.name} />
      <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={userId} targetLabel={p.name} />
    </>
  );
};

export default TeacherProfilePage;
