import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, Spinner, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import useAuth from "../../hooks/useAuth.js";
import { bookingsApi, chatApi, interestsApi, listingsApi, profilesApi, recommendationsApi, verificationApi } from "../../api/endpoints.js";
import { apiError, apiErrorCode, firstName, formatDate, formatDateTime, formatTime, relativeTime } from "../../lib/format.js";
import { Greeting, Section, SummaryCard } from "./shared.jsx";
import { thisWeek, upcoming } from "../../lib/bookings.js";

const TeacherHome = () => {
  const { user } = useAuth();
  const [busyId, setBusyId] = useState(null);

  const { data: bookingsData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);
  const { data: received, setData: setReceived } = useAsync(() => interestsApi.received({ limit: 50 }), []);
  const { data: convs } = useAsync(() => chatApi.conversations(), []);
  const { data: mine } = useAsync(() => listingsApi.mine(), []);
  const { data: profileData, loading: profileLoading } = useAsync(() => profilesApi.getTeacher(user._id).catch(() => null), [user._id]);
  const { data: verification } = useAsync(() => verificationApi.me(), []);
  const { data: leads } = useAsync(() => recommendationsApi.students({ limit: 4 }).catch(() => ({ recommendations: [] })), []);

  const bookings = bookingsData?.bookings || [];
  const next = upcoming(bookings)[0];
  const week = thisWeek(bookings);
  const requests = received?.interests || [];
  const pending = requests.filter((i) => i.status === "pending");
  const lastIncoming = (convs?.conversations || []).find((c) => c.lastMessage && String(c.lastMessage.senderId) !== String(user._id));
  const listings = (mine?.listings || []).filter((l) => l.status !== "closed");
  const profile = profileData?.profile;
  const tier = verification?.verificationTier || "none";

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const taughtThisMonth = bookings.filter((b) => b.status === "completed" && new Date(b.startTime) >= monthStart).length;
  const newStudents = requests.filter((i) => ["accepted", "completed"].includes(i.status) && i.respondedAt && new Date(i.respondedAt) >= monthStart).length;

  const respond = async (interest, status) => {
    setBusyId(interest._id);
    try {
      const { interestRequest } = await interestsApi.respond(interest._id, status);
      setReceived((d) => ({ ...d, interests: d.interests.map((i) => (i._id === interest._id ? { ...i, status: interestRequest.status } : i)) }));
      toast.success(status === "accepted" ? `Accepted ${firstName(interest.fromUser?.isChild ? interest.fromUser.parentName : interest.fromUser?.name)}. They've been notified.` : "Request declined.");
    } catch (err) {
      toast.error(apiErrorCode(err) === "TEACHER_NOT_FULLY_VERIFIED" ? "Only fully verified teachers can accept requests for child accounts." : apiError(err));
    } finally {
      setBusyId(null);
    }
  };

  const shownRequests = [...pending, ...requests.filter((i) => i.status !== "pending")].slice(0, 5);

  return (
    <div className="shell flex flex-col gap-7 pb-20 pt-10">
      <Greeting
        name={user.name}
        actions={
          <>
            <Link to="/availability" className="btn btn-outline">Update availability</Link>
            <Link to="/listings/new" className="btn btn-primary">+ Post a class ad</Link>
          </>
        }
      />

      {!profile && !profileLoading && (
        <div className="card-mist flex flex-wrap items-center justify-between gap-5 px-[26px] py-[22px]">
          <div className="flex flex-col gap-1.5">
            <span className="serif text-xl font-bold">Build your teaching profile</span>
            <span className="text-sm text-ink-2">Add your subjects, levels and a short bio — students read it before they send a request.</span>
          </div>
          <Link to="/profile/edit" className="btn btn-primary">Build profile</Link>
        </div>
      )}

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
        <SummaryCard
          dark
          eyebrow={next ? `NEXT CLASS · ${relativeTime(next.startTime) === "Just now" ? "NOW" : formatDate(next.startTime, { weekday: "short", day: "numeric", month: "short" }).toUpperCase()}` : "NEXT CLASS"}
          title={next ? `${next.listing?.subject || "Class"} with ${next.student?.isChild ? next.student.name : next.student?.name || "your student"}` : "Nothing booked yet"}
          footer={
            <>
              <Link to="/bookings" className="btn btn-light btn-sm">{next ? "View booking" : "View bookings"}</Link>
              <Link to="/chat" className="btn btn-sm border-0 bg-transparent text-lavender hover:text-white">Messages</Link>
            </>
          }
        >
          <span className="text-sm text-on-dark">
            {next ? `${formatDateTime(next.startTime)} – ${formatTime(next.endTime)}` : "Students book trial classes from your weekly availability once you accept them."}
          </span>
        </SummaryCard>
        <SummaryCard eyebrow="NEW REQUESTS" title={`${pending.length} waiting for your reply`} footer={<Link to="/interests?tab=received" className="text-sm font-semibold">Review all requests →</Link>}>
          <span className="text-sm text-ink-2">Replying within a day helps students decide faster.</span>
        </SummaryCard>
        <SummaryCard
          eyebrow="MESSAGES"
          title={lastIncoming ? "Latest message" : "No messages yet"}
          footer={<Link to={lastIncoming ? `/chat/${lastIncoming._id}` : "/chat"} className="text-sm font-semibold">Open chat →</Link>}
        >
          {lastIncoming ? (
            <div className="flex items-start gap-2.5">
              <Avatar name={lastIncoming.otherParty?.name} size={32} />
              <span className="serif text-base italic leading-snug">“{lastIncoming.lastMessage.text}”</span>
            </div>
          ) : (
            <span className="text-sm text-ink-2">Chats open when you accept a request.</span>
          )}
        </SummaryCard>
      </div>

      <div className="flex flex-wrap items-start gap-9">
        <div className="flex min-w-0 flex-col gap-10" style={{ flex: "999 1 620px" }}>
          <Section title="Interest requests" link={{ to: "/interests?tab=received", label: "See all" }}>
            <div className="card overflow-hidden">
              {shownRequests.map((r) => {
                const who = r.fromUser?.isChild ? r.fromUser.parentName || "A family" : r.fromUser?.name || "Someone";
                const blocked = r.fromUser?.isChild && tier !== "fully_verified";
                return (
                  <div key={r._id} className="divider-row rise flex flex-wrap items-center gap-3.5 px-[22px] py-[18px]" style={{ background: r.status === "pending" ? "#fff" : "var(--page)" }}>
                    <Avatar name={who} size={42} />
                    <div className="flex min-w-0 flex-col gap-1" style={{ flex: "1 1 260px" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="serif text-[17px] font-bold">{who}</span>
                        {r.fromUser?.isChild && <span className="status status-muted text-[11px]">For child · {r.fromUser.name}{r.fromUser.grade ? `, ${r.fromUser.grade}` : ""}</span>}
                        <span className="text-xs text-ink-2">{relativeTime(r.createdAt)}</span>
                      </div>
                      <span className="text-[13px] font-semibold text-primary">{r.listing ? `${r.listing.subject} · ${r.listing.grade}` : ""}</span>
                      <span className="truncate text-sm text-ink-2">“{r.message}”</span>
                    </div>
                    {r.status === "pending" ? (
                      <div className="flex flex-none gap-2">
                        <button type="button" className="btn btn-soft btn-sm hover:border-danger hover:text-danger" disabled={busyId === r._id} onClick={() => respond(r, "declined")}>Decline</button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={busyId === r._id || blocked}
                          title={blocked ? "Only fully verified teachers can accept requests for child accounts" : undefined}
                          onClick={() => respond(r, "accepted")}
                        >
                          {busyId === r._id && <Spinner dark={false} />} Accept
                        </button>
                      </div>
                    ) : (
                      <StatusBadge status={r.status} />
                    )}
                  </div>
                );
              })}
              {shownRequests.length === 0 && (
                <div className="p-8 text-center text-sm text-ink-2">
                  No requests yet. {listings.length ? "Students' requests on your ads will appear here." : <><Link to="/listings/new" className="font-semibold">Post a class ad</Link> so students can find you.</>}
                </div>
              )}
            </div>
          </Section>

          <Section title="Your listings" link={{ to: "/listings/mine", label: "Manage" }}>
            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
              {listings.slice(0, 3).map((l) => (
                <Link key={l._id} to={`/listings/${l._id}/edit`} className="card flex flex-col gap-3 p-5 text-ink hover:border-lavender hover:text-ink">
                  <StatusBadge status={l.status === "active" ? "active" : l.status} className="self-start text-[11px]" />
                  <span className="serif text-[17px] font-bold leading-snug">{l.subject} — {l.grade}</span>
                  <div className="grid grid-cols-2 gap-2.5 border-t border-mist pt-3">
                    <div><div className="serif text-2xl leading-none">{l.stats?.views30d ?? 0}</div><div className="mt-1 text-xs text-ink-2">Views · 30d</div></div>
                    <div><div className="serif text-2xl leading-none text-primary">{l.stats?.interestCount ?? 0}</div><div className="mt-1 text-xs text-ink-2">Requests</div></div>
                  </div>
                </Link>
              ))}
              {listings.length === 0 && (
                <Link to="/listings/new" className="flex flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed p-6 text-center hover:border-primary" style={{ borderColor: "var(--lavender)" }}>
                  <span className="serif text-xl text-ink">Post your first class ad</span>
                  <span className="text-sm text-ink-2">Students find you through your ads.</span>
                </Link>
              )}
            </div>
          </Section>

          {leads?.recommendations?.length > 0 && (
            <Section title="Students looking for a teacher" sub="Wanted ads that match your subjects and levels" link={{ to: "/browse", label: "Browse" }}>
              <div className="card overflow-hidden">
                {leads.recommendations.map(({ listing, reason }) => (
                  <Link key={listing._id} to={`/listings/${listing._id}`} className="divider-row flex flex-wrap items-center gap-3.5 px-[22px] py-4 text-ink hover:bg-tint hover:text-ink">
                    <span className="serif flex h-10 w-10 flex-none items-center justify-center rounded-[10px] bg-mist text-lg font-bold italic text-primary">{listing.subject[0]}</span>
                    <div className="flex min-w-0 flex-col" style={{ flex: "1 1 240px" }}>
                      <span className="serif text-base font-bold">{listing.subject} · {listing.grade}</span>
                      {reason && <span className="text-[13px] text-primary">{reason}</span>}
                    </div>
                    <span className="text-sm font-semibold text-primary">View →</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>

        <aside className="flex min-w-0 max-w-full flex-col gap-[18px]" style={{ flex: "1 1 300px" }}>
          <div className="card flex flex-col gap-3.5 p-[22px]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-xl font-bold">This week</span>
              <Link to="/availability" className="text-[13px] font-semibold">Schedule →</Link>
            </div>
            {week.map((b, i) => {
              const d = new Date(b.startTime);
              return (
                <div key={b._id} className="flex items-center gap-3 rounded-[10px] px-3 py-2.5" style={{ background: i === 0 ? "var(--mist)" : "var(--page)" }}>
                  <div className="flex w-[38px] flex-none flex-col items-center">
                    <span className="text-[11px] font-bold text-ink-2">{d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                    <span className="serif text-xl leading-none">{d.getDate()}</span>
                  </div>
                  <div className="w-[3px] self-stretch rounded-sm bg-primary" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{b.listing?.subject || "Class"} · {b.student?.name}</div>
                    <div className="text-xs text-ink-2">{formatTime(b.startTime)} – {formatTime(b.endTime)}</div>
                  </div>
                </div>
              );
            })}
            {week.length === 0 && <span className="text-sm text-ink-2">No classes booked this week.</span>}
          </div>

          <div className="card-mist flex flex-col gap-3.5 rounded-2xl p-[22px]">
            <span className="serif text-xl font-bold">{new Date().toLocaleDateString("en-GB", { month: "long" })} so far</span>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                [taughtThisMonth, "Classes taught"],
                [profile?.reviewCount ? Number(profile.avgRating).toFixed(1) : "—", "Avg rating"],
                [newStudents, "New students"],
                [pending.length, "Awaiting reply"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-xl bg-white p-3.5">
                  <div className="serif text-[28px] leading-none">{v}</div>
                  <div className="mt-1.5 text-xs text-ink-2">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card-dark flex items-start gap-3.5 rounded-2xl p-[22px]">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary font-bold">✓</span>
            <div className="flex flex-col gap-1.5">
              <span className="serif text-[19px]">
                {tier === "fully_verified" ? "Fully verified" : tier === "id_verified" ? "ID verified" : verification?.status === "pending_review" ? "Verification in review" : "Not verified yet"}
              </span>
              <span className="text-[13px] leading-normal text-on-dark">
                {tier === "fully_verified"
                  ? "Parents can send requests for their children."
                  : tier === "id_verified"
                    ? "Add a police clearance report to accept requests for children."
                    : "Verified teachers appear in search and earn families' trust."}
              </span>
              <Link to="/verification" className="text-[13px] font-semibold text-lavender hover:text-white">Verification details →</Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default TeacherHome;
