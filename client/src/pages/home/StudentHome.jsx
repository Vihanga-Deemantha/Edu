import { useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Skeleton, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import useAuth from "../../hooks/useAuth.js";
import { bookingsApi, chatApi, interestsApi, profilesApi, recommendationsApi } from "../../api/endpoints.js";
import { firstName, formatDateTime, formatTime, relativeTime } from "../../lib/format.js";
import { Greeting, RecommendationCard, Section, SummaryCard, WeekStrip } from "./shared.jsx";
import { thisWeek, upcoming } from "../../lib/bookings.js";

const FILTERS = ["all", "accepted", "pending", "completed"];
const EXPLORE = ["Combined Maths", "Chemistry", "Physics", "English", "ICT"];

const StudentHome = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState("all");
  const [hideProfile, setHideProfile] = useState(false);

  const { data: bookingsData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);
  const { data: sent } = useAsync(() => interestsApi.sent({ limit: 50 }), []);
  const { data: convs } = useAsync(() => chatApi.conversations(), []);
  const { data: recs, loading: recLoading } = useAsync(() => recommendationsApi.teachers({ limit: 6 }).catch(() => ({ recommendations: [] })), []);
  const { data: profile } = useAsync(() => profilesApi.getStudent(user._id).then((d) => d.profile).catch(() => null), [user._id]);

  const bookings = bookingsData?.bookings || [];
  const next = upcoming(bookings)[0];
  const interests = sent?.interests || [];
  const accepted = interests.filter((i) => i.status === "accepted");
  const pending = interests.filter((i) => i.status === "pending");
  const latestAccepted = accepted[0];
  const lastIncoming = (convs?.conversations || []).find((c) => c.lastMessage && String(c.lastMessage.senderId) !== String(user._id));
  const shown = interests.filter((i) => filter === "all" || i.status === filter).slice(0, 6);
  const week = thisWeek(bookings);

  const checks = [Boolean(profile?.gradeOrLevel), profile?.subjectsInterested?.length > 0, profile?.medium?.length > 0, Boolean(profile?.location)];
  const done = checks.filter(Boolean).length + 1; // +1: account created & verified

  return (
    <div className="shell flex flex-col gap-8 pb-20 pt-11">
      <Greeting name={user.name} actions={<Link to="/browse" className="btn btn-primary">Find a new teacher</Link>} />

      {!hideProfile && done < 5 && (
        <div className="card-mist flex flex-wrap items-center gap-6 px-[26px] py-[22px]">
          <div className="flex flex-col gap-2.5" style={{ flex: "1 1 320px" }}>
            <span className="serif text-[19px] font-bold">Finish your profile for better matches</span>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded bg-white"><div className="h-full rounded bg-primary" style={{ width: `${(done / 5) * 100}%` }} /></div>
              <span className="text-[13px] font-semibold text-primary">{done} of 5</span>
            </div>
            <span className="text-sm text-ink-2">Add your subjects, grade and preferred medium so we can recommend the right teachers.</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Link to="/profile/edit" className="btn btn-primary btn-sm">Complete profile</Link>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setHideProfile(true)}>Later</button>
          </div>
        </div>
      )}

      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
        <SummaryCard
          dark
          eyebrow="NEXT CLASS"
          title={next ? `${next.listing?.subject || "Class"} with ${next.teacher?.name || "your teacher"}` : "No class booked yet"}
          footer={
            next ? (
              <>
                {next.payment?.status !== "paid" && <Link to="/bookings" className="btn btn-light btn-sm">Pay deposit</Link>}
                <Link to="/bookings" className="btn btn-sm border-0 bg-transparent text-lavender hover:text-white">Details</Link>
              </>
            ) : (
              <Link to="/interests?tab=sent" className="btn btn-light btn-sm">Book from an accepted interest</Link>
            )
          }
        >
          {next ? (
            <>
              <span className="text-sm text-on-dark">{formatDateTime(next.startTime)} – {formatTime(next.endTime)}</span>
              <div className="flex flex-wrap gap-2">
                <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-xs font-semibold">Confirmed</span>
                <span className="whitespace-nowrap rounded-full border border-blue px-2.5 py-1 text-xs font-semibold text-lavender">
                  {next.payment?.status === "paid" ? "Deposit paid" : "Deposit unpaid"}
                </span>
              </div>
            </>
          ) : (
            <span className="text-sm text-on-dark">Once a teacher accepts your interest, book a trial class from their availability.</span>
          )}
        </SummaryCard>
        <SummaryCard
          eyebrow="INTERESTS"
          title={`${accepted.length} accepted · ${pending.length} awaiting a reply`}
          footer={<Link to={latestAccepted?.conversationId ? `/chat/${latestAccepted.conversationId}` : "/interests?tab=sent"} className="text-sm font-semibold">{latestAccepted ? "Start chatting →" : "View interests →"}</Link>}
        >
          <span className="text-sm text-ink-2">
            {latestAccepted
              ? `${latestAccepted.toUser?.name || "A teacher"} accepted your request for ${latestAccepted.listing?.subject || "a class"}.`
              : interests.length ? "We'll notify you as soon as a teacher replies." : "Send an interest to a teacher to get started."}
          </span>
        </SummaryCard>
        <SummaryCard
          eyebrow="MESSAGES"
          title={lastIncoming ? "Latest message" : "No messages yet"}
          footer={<Link to={lastIncoming ? `/chat/${lastIncoming._id}` : "/chat"} className="text-sm font-semibold">{lastIncoming ? `Reply to ${firstName(lastIncoming.otherParty?.name)} →` : "Open chat →"}</Link>}
        >
          {lastIncoming ? (
            <div className="flex items-start gap-2.5">
              <Avatar name={lastIncoming.otherParty?.name} src={lastIncoming.otherParty?.photoUrl} size={32} />
              <span className="serif text-base italic leading-snug">“{lastIncoming.lastMessage.text}”</span>
            </div>
          ) : (
            <span className="text-sm text-ink-2">Chat opens automatically when a teacher accepts your interest.</span>
          )}
        </SummaryCard>
      </div>

      <div className="flex flex-wrap items-start gap-9">
        <div className="flex min-w-0 flex-col gap-11" style={{ flex: "999 1 620px" }}>
          <Section title="Recommended for you" sub="Based on your grade, subjects and location" link={{ to: "/browse?sort=recommended", label: "See all" }}>
            {recLoading ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
                {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 260, borderRadius: 16 }} />)}
              </div>
            ) : recs?.recommendations?.length ? (
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
                {recs.recommendations.slice(0, 3).map((r) => <RecommendationCard key={r.listing._id} rec={r} />)}
              </div>
            ) : (
              <div className="card px-6 py-8 text-center text-sm text-ink-2">
                No recommendations yet. <Link to="/profile/edit" className="font-semibold">Add your subjects</Link> or <Link to="/browse" className="font-semibold">browse teachers</Link>.
              </div>
            )}
          </Section>

          <section className="flex flex-col gap-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="h-block">Your interests</h2>
              <div className="seg">
                {FILTERS.map((f) => (
                  <button key={f} type="button" className={`seg-item capitalize ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div className="card overflow-hidden">
              {shown.map((i) => {
                const action =
                  i.status === "accepted" && i.conversationId
                    ? { to: `/chat/${i.conversationId}`, label: "Chat →" }
                    : i.status === "completed" && !i.hasReview
                      ? { to: "/interests?tab=sent", label: "Leave a review" }
                      : i.status === "declined"
                        ? { to: `/browse?subject=${encodeURIComponent(i.listing?.subject || "")}`, label: "Find similar" }
                        : { to: "/interests?tab=sent", label: "View" };
                return (
                  <div key={i._id} className="divider-row grid items-center gap-5 px-[22px] py-[18px]" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto" }}>
                    <div className="flex min-w-0 items-center gap-3.5">
                      <Avatar name={i.toUser?.name} src={i.toUser?.photoUrl} size={40} />
                      <div className="min-w-0">
                        <div className="serif truncate text-[17px] font-bold">{i.toUser?.name || "Teacher"}</div>
                        <div className="truncate text-[13px] text-ink-2">{i.listing ? `${i.listing.subject} · ${i.listing.grade}` : ""} · {relativeTime(i.createdAt)}</div>
                      </div>
                    </div>
                    <StatusBadge status={i.status} />
                    <Link to={action.to} className="min-w-[90px] text-right text-sm font-semibold">{action.label}</Link>
                  </div>
                );
              })}
              {shown.length === 0 && (
                <div className="flex flex-col items-center gap-2 p-10 text-center">
                  <span className="serif text-[22px]">Nothing here yet</span>
                  <span className="text-sm text-ink-2">{interests.length ? "Interests in this state will show up here." : "Browse teachers and send your first interest request."}</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 max-w-full flex-col gap-[18px]" style={{ flex: "1 1 300px" }}>
          <div className="card flex flex-col gap-4 p-[22px]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-xl font-bold">This week</span>
              <Link to="/bookings" className="text-[13px] font-semibold">Bookings →</Link>
            </div>
            <WeekStrip bookings={week} />
            <div className="flex flex-col gap-2.5">
              {week.map((b, idx) => (
                <div key={b._id} className="flex items-center gap-3 rounded-[10px] bg-mist p-3">
                  <div className="w-1 self-stretch rounded-sm" style={{ background: idx % 2 ? "var(--blue)" : "var(--primary)" }} />
                  <div>
                    <div className="text-sm font-semibold">{b.listing?.subject || "Class"}</div>
                    <div className="text-xs text-ink-2">{new Date(b.startTime).toLocaleDateString("en-GB", { weekday: "short" })} · {formatTime(b.startTime)} · {b.teacher?.name}</div>
                  </div>
                </div>
              ))}
              {week.length === 0 && <span className="text-sm text-ink-2">No classes this week.</span>}
            </div>
          </div>

          <div className="card flex flex-col gap-3.5 p-[22px]">
            <span className="serif text-xl font-bold">Keep exploring</span>
            <div className="flex flex-wrap gap-2">
              {[...(profile?.subjectsInterested || []), ...EXPLORE].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6).map((s) => (
                <Link key={s} to={`/browse?q=${encodeURIComponent(s)}`} className="chip">{s}</Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-2xl bg-primary p-[22px] text-white">
            <span className="serif text-xl font-bold">Can't find the right fit?</span>
            <span className="text-sm leading-normal text-mist">Post a “wanted” ad. Verified teachers who match will reach out to you.</span>
            <Link to="/listings/new" className="btn btn-light btn-sm mt-1.5 self-start text-primary">Post a wanted ad</Link>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default StudentHome;
