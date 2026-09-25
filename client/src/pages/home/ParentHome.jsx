import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Avatar, Skeleton, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import useAuth from "../../hooks/useAuth.js";
import { bookingsApi, chatApi, interestsApi, recommendationsApi } from "../../api/endpoints.js";
import { firstName, formatMinorAmount, formatTime } from "../../lib/format.js";
import { Greeting, RecommendationCard, Section } from "./shared.jsx";
import { upcoming } from "../../lib/bookings.js";

const ParentHome = () => {
  const { user } = useAuth();
  const kids = useMemo(() => user.linkedChildIds || [], [user]);
  const [kid, setKid] = useState("all");

  const { data: bookingsData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);
  const { data: sent } = useAsync(() => interestsApi.sent({ limit: 50 }), []);
  const { data: convs } = useAsync(() => chatApi.conversations(), []);
  const recTarget = kid === "all" ? kids[0]?._id : kid;
  const { data: recs, loading: recLoading } = useAsync(
    () => recommendationsApi.teachers({ targetUserId: recTarget, limit: 6 }).catch(() => ({ recommendations: [] })),
    [recTarget],
    { enabled: Boolean(recTarget) }
  );

  const nameOf = (id) => kids.find((k) => String(k._id) === String(id))?.name;
  const pick = (id) => kid === "all" || String(id) === String(kid);
  const bookings = (bookingsData?.bookings || []).filter((b) => pick(b.studentId));
  const interests = (sent?.interests || []).filter((i) => pick(i.fromUserId));
  const next = upcoming(bookings);
  const unpaid = next.filter((b) => b.payment?.status !== "paid");
  const pending = interests.filter((i) => i.status === "pending");
  const lastIncoming = (convs?.conversations || []).find((c) => c.lastMessage && String(c.lastMessage.senderId) !== String(user._id) && (kid === "all" || String(c.child?._id) === String(kid)));

  // Up to three "needs your attention" cards, most urgent first.
  const needs = [
    ...unpaid.slice(0, 1).map((b) => ({
      dark: true, kicker: "DEPOSIT DUE", child: nameOf(b.studentId),
      title: `${b.listing?.subject || "Class"} on ${new Date(b.startTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
      body: "Pay the deposit before the class to keep the slot.", cta: "Pay deposit", to: "/bookings",
    })),
    ...pending.slice(0, 1).map((i) => ({
      kicker: "REQUEST PENDING", child: nameOf(i.fromUserId),
      title: `${i.toUser?.name || "The teacher"} hasn't replied yet`,
      body: `Sent for ${i.listing?.subject || "a class"}. Most teachers reply within 2 days.`, cta: "View request", to: "/interests?tab=sent",
    })),
    ...(lastIncoming
      ? [{
          kicker: "NEW MESSAGE", child: lastIncoming.child?.name,
          title: `${lastIncoming.otherParty?.name || "A teacher"} sent a message`,
          body: `“${lastIncoming.lastMessage.text.slice(0, 120)}”`, cta: "Reply", to: `/chat/${lastIncoming._id}`,
        }]
      : []),
    ...next.filter((b) => b.payment?.status === "paid").slice(0, 1).map((b) => ({
      kicker: "NEXT CLASS", child: nameOf(b.studentId),
      title: `${b.listing?.subject || "Class"}, ${new Date(b.startTime).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`,
      body: `${formatTime(b.startTime)} – ${formatTime(b.endTime)} with ${b.teacher?.name || "the teacher"}. Deposit paid.`, cta: "Details", to: "/bookings",
    })),
  ].slice(0, 3);

  const paidByKid = kids.map((k) => ({
    k,
    total: (bookingsData?.bookings || []).filter((b) => String(b.studentId) === String(k._id) && b.payment?.status === "paid").reduce((n, b) => n + (b.payment.amount || 0), 0),
  }));
  const totalPaid = paidByKid.reduce((n, x) => n + x.total, 0);
  const currency = (bookingsData?.bookings || []).find((b) => b.payment)?.payment?.currency || "usd";
  const selName = kid === "all" ? "your children" : nameOf(kid);

  return (
    <div className="shell flex flex-col gap-7 pb-20 pt-10">
      <Greeting
        name={user.name}
        actions={
          kids.length > 0 && (
            <div className="flex flex-wrap rounded-full bg-mist p-1" role="tablist">
              {[{ _id: "all", name: "All" }, ...kids].map((k) => {
                const on = kid === k._id;
                return (
                  <button
                    key={k._id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setKid(k._id)}
                    className="flex items-center gap-2 rounded-full border-0 py-[7px] pl-2 pr-4 text-sm font-semibold"
                    style={{ background: on ? "#fff" : "transparent", color: on ? "var(--ink)" : "var(--ink-2)", boxShadow: on ? "0 1px 3px rgba(22,27,63,.15)" : "none" }}
                  >
                    <span className="serif flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold" style={{ background: on ? "var(--primary)" : "#fff", color: on ? "#fff" : "var(--primary)" }}>
                      {k._id === "all" ? "★" : k.name[0]}
                    </span>
                    {k.name}
                  </button>
                );
              })}
            </div>
          )
        }
      />

      {kids.length === 0 && (
        <div className="card-mist flex flex-wrap items-center justify-between gap-5 px-[26px] py-[22px]">
          <div className="flex flex-col gap-1.5">
            <span className="serif text-xl font-bold">Add your child to get started</span>
            <span className="text-sm text-ink-2">Requests, chats and bookings on EduLink are made on behalf of a specific child.</span>
          </div>
          <Link to="/children" className="btn btn-primary">+ Add a child</Link>
        </div>
      )}

      {needs.length > 0 && (
        <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
          {needs.map((n) => (
            <div key={n.kicker} className="rise flex flex-col gap-3 rounded-2xl border p-6" style={{ background: n.dark ? "var(--ink)" : "#fff", color: n.dark ? "#fff" : "var(--ink)", borderColor: n.dark ? "var(--ink)" : "var(--line)" }}>
              <div className="flex items-center justify-between gap-2.5">
                <span className="text-xs font-bold tracking-[.12em]" style={{ color: n.dark ? "var(--lavender)" : "var(--primary)" }}>{n.kicker}</span>
                {n.child && <span className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={{ background: n.dark ? "rgba(255,255,255,.12)" : "var(--mist)", color: n.dark ? "#fff" : "var(--primary)" }}>{n.child}</span>}
              </div>
              <span className="serif text-2xl leading-tight">{n.title}</span>
              <span className="text-sm leading-normal" style={{ color: n.dark ? "var(--on-dark)" : "var(--ink-2)" }}>{n.body}</span>
              <Link to={n.to} className={`btn btn-sm mt-auto self-start ${n.dark ? "btn-light" : "btn-primary"}`}>{n.cta}</Link>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-9">
        <div className="flex min-w-0 flex-col gap-10" style={{ flex: "999 1 620px" }}>
          <Section title="Upcoming classes" link={{ to: "/bookings", label: "All bookings" }}>
            <div className="card overflow-hidden">
              {next.slice(0, 5).map((b) => {
                const d = new Date(b.startTime);
                return (
                  <div key={b._id} className="divider-row flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="flex w-[58px] flex-none flex-col items-center rounded-[10px] bg-mist py-2">
                      <span className="text-[11px] font-bold text-primary">{d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                      <span className="serif text-2xl leading-none">{d.getDate()}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1" style={{ flex: "1 1 240px" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="serif text-[17px] font-bold">{b.listing?.subject || "Class"}</span>
                        {nameOf(b.studentId) && <span className="status status-outline text-[11px]">{nameOf(b.studentId)}</span>}
                      </div>
                      <span className="text-[13px] text-ink-2">{formatTime(b.startTime)} – {formatTime(b.endTime)} · with {b.teacher?.name}</span>
                    </div>
                    <StatusBadge status={b.payment?.status === "paid" ? "confirmed" : "unpaid"} label={b.payment?.status === "paid" ? "Confirmed" : "Deposit due"} />
                  </div>
                );
              })}
              {next.length === 0 && <div className="p-8 text-center text-sm text-ink-2">No classes booked for {selName} yet.</div>}
            </div>
          </Section>

          {kids.length > 0 && (
            <Section
              title={kid === "all" ? `Recommended for ${firstName(kids[0].name)}` : `Recommended for ${selName}`}
              sub="Based on grade and subjects · only fully verified teachers can accept child requests"
              link={{ to: "/browse", label: "Browse" }}
            >
              {recLoading ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 240, borderRadius: 16 }} />)}
                </div>
              ) : recs?.recommendations?.length ? (
                <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {recs.recommendations.slice(0, 3).map((r) => <RecommendationCard key={r.listing._id} rec={r} />)}
                </div>
              ) : (
                <div className="card px-6 py-8 text-center text-sm text-ink-2">
                  No recommendations yet. <Link to="/children" className="font-semibold">Add subjects to the learning profile</Link> to get matches.
                </div>
              )}
            </Section>
          )}
        </div>

        <aside className="flex min-w-0 max-w-full flex-col gap-[18px]" style={{ flex: "1 1 300px" }}>
          <div className="card flex flex-col gap-3.5 p-[22px]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-xl font-bold">Your children</span>
              <Link to="/children" className="text-[13px] font-semibold">Manage →</Link>
            </div>
            {kids.map((k) => {
              const kidPending = (sent?.interests || []).filter((i) => String(i.fromUserId) === String(k._id) && i.status === "pending").length;
              const kidDue = upcoming((bookingsData?.bookings || []).filter((b) => String(b.studentId) === String(k._id))).filter((b) => b.payment?.status !== "paid").length;
              return (
                <Link key={k._id} to="/children" className="flex items-center gap-3 rounded-xl border border-line-soft bg-page p-3 text-ink hover:border-lavender hover:text-ink">
                  <Avatar name={k.name} size={42} />
                  <div className="min-w-0 flex-1">
                    <div className="serif text-base font-bold">{k.name}</div>
                    <div className="text-xs text-ink-2">{[k.grade, kidPending ? `${kidPending} request pending` : null].filter(Boolean).join(" · ") || "Child account"}</div>
                  </div>
                  {kidDue > 0 && <span className="h-2 w-2 flex-none rounded-full bg-danger" aria-label="Deposit due" />}
                </Link>
              );
            })}
            <Link to="/children" className="rounded-[10px] border-[1.5px] border-dashed p-2.5 text-center text-sm font-semibold hover:border-primary" style={{ borderColor: "var(--lavender)" }}>+ Add a child</Link>
          </div>

          {kids.length > 0 && (
            <div className="card-mist flex flex-col gap-3 rounded-2xl p-[22px]">
              <span className="serif text-xl font-bold">Deposits paid</span>
              <div className="flex items-baseline gap-2">
                <span className="serif text-[34px] leading-none">{formatMinorAmount(totalPaid, currency)}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]">
                    {paidByKid.filter((x) => x.total).map((x, i) => (
                      <div key={x.k._id} style={{ flex: x.total, background: i % 2 ? "var(--blue)" : "var(--primary)" }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3.5 text-xs text-ink-2">
                    {paidByKid.filter((x) => x.total).map((x, i) => (
                      <span key={x.k._id} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: i % 2 ? "var(--blue)" : "var(--primary)" }} />
                        {x.k.name} · {formatMinorAmount(x.total, currency)}
                      </span>
                    ))}
                  </div>
                </>
              )}
              <Link to="/bookings" className="text-[13px] font-semibold">Payment history →</Link>
            </div>
          )}

          <div className="card-dark flex flex-col gap-2 rounded-2xl p-[22px]">
            <span className="serif text-[19px]">You see every message</span>
            <span className="text-[13px] leading-normal text-on-dark">
              Teachers message you, never your child directly. Report anything that doesn't feel right and our team will review it within 24 hours.
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ParentHome;
