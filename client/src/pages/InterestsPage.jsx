import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, EmptyState, PageLoader, StarInput, StatusBadge, Spinner } from "../components/ui/index.jsx";
import BookingModal from "../components/BookingModal.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { interestsApi, reviewsApi, verificationApi } from "../api/endpoints.js";
import { apiError, apiErrorCode, firstName, formatDateTime, formatPrice, relativeTime, roleLabel } from "../lib/format.js";

const FILTERS = [
  ["all", "All"],
  ["pending", "Pending"],
  ["accepted", "Accepted"],
  ["completed", "Completed"],
  ["declined", "Declined"],
];

/** Who's on the other side of an interest, labelled the way a person would say it. */
const otherParty = (interest, box) => {
  const other = box === "sent" ? interest.toUser : interest.fromUser;
  const mine = box === "sent" ? interest.fromUser : interest.toUser;
  if (!other) return { name: "Unknown user", sub: "", child: mine?.isChild ? mine.name : null };
  if (other.isChild) {
    return {
      name: other.parentName || "A family",
      sub: `Parent · request for ${other.name}${other.grade ? `, ${other.grade}` : ""}`,
      childOfOther: other.name,
      child: mine?.isChild ? mine.name : null,
      raw: other,
    };
  }
  return {
    name: other.name,
    sub: `${roleLabel(other.role)}${other.verificationStatus === "fully_verified" ? " · Fully verified" : other.verificationStatus === "id_verified" ? " · ID verified" : ""}`,
    child: mine?.isChild ? mine.name : null,
    raw: other,
  };
};

const ReviewForm = ({ interest, teacherName, onDone }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!rating) return setError("Choose a star rating.");
    setBusy(true);
    try {
      await reviewsApi.create({ linkedRequestId: interest._id, rating, ...(comment.trim() ? { comment: comment.trim() } : {}) });
      toast.success("Thanks! Your review is live.");
      onDone({ rating, comment: comment.trim() });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };
  return (
    <div className="flex flex-col gap-3.5 rounded-[14px] bg-mist p-[22px]">
      <div className="flex flex-col gap-1">
        <span className="serif text-2xl">How was your class with {firstName(teacherName)}?</span>
        <span className="text-[13px] text-ink-2">Your name stays private. Only “Verified student” is shown. Reviews can't be edited later.</span>
      </div>
      <div className="flex items-center gap-2.5">
        <StarInput value={rating} onChange={(n) => { setRating(n); setError(""); }} />
        <span className="text-sm font-semibold text-primary">{["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}</span>
      </div>
      <textarea rows={3} maxLength={1000} className="textarea serif min-h-0 text-base" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What did you like? What could be better?" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-danger">{error}</span>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner dark={false} />} Submit review</button>
      </div>
    </div>
  );
};

const InterestsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const box = params.get("tab") === "received" || (!params.get("tab") && user.role === "teacher") ? "received" : "sent";
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState(null);
  const [myReviews, setMyReviews] = useState({});

  const { data: sent, loading: l1, setData: setSent } = useAsync(() => interestsApi.sent({ limit: 50 }), []);
  const { data: received, loading: l2, setData: setReceived } = useAsync(() => interestsApi.received({ limit: 50 }), []);
  const { data: verification } = useAsync(() => verificationApi.me(), [], { enabled: user.role === "teacher" });

  const inBox = useMemo(() => (box === "sent" ? sent?.interests : received?.interests) || [], [box, sent, received]);
  const list = inBox.filter((i) => filter === "all" || i.status === filter);
  const sel = list.find((i) => i._id === selId) || list[0];
  const pendingReceived = (received?.interests || []).filter((i) => i.status === "pending").length;

  if (l1 || l2) return <PageLoader />;

  const replace = (updated) => {
    const setter = box === "sent" ? setSent : setReceived;
    setter((d) => ({ ...d, interests: d.interests.map((i) => (i._id === updated._id ? { ...i, ...updated } : i)) }));
  };

  const childInvolved = sel && (sel.fromUser?.isChild || sel.toUser?.isChild);
  const teacherIsMe = user.role === "teacher";
  const blocked = Boolean(sel && box === "received" && teacherIsMe && childInvolved && verification?.verificationTier !== "fully_verified");

  const respond = async (status) => {
    setBusy(true);
    try {
      const { interestRequest, conversationId } = await interestsApi.respond(sel._id, status);
      replace({ ...interestRequest, conversationId: conversationId ?? sel.conversationId, listing: sel.listing, fromUser: sel.fromUser, toUser: sel.toUser });
      toast.success(status === "accepted" ? "Accepted. They've been notified." : "Request declined.");
      setDeclining(false);
    } catch (err) {
      toast.error(apiErrorCode(err) === "TEACHER_NOT_FULLY_VERIFIED" ? "Only fully verified teachers can accept requests for child accounts." : apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      const { interestRequest } = await interestsApi.complete(sel._id);
      replace({ status: interestRequest.status, _id: sel._id });
      toast.success("Marked as completed.");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const party = sel ? otherParty(sel, box) : null;
  const teacherSide = sel && (sel.fromUser?.role === "teacher" ? sel.fromUser : sel.toUser?.role === "teacher" ? sel.toUser : null);
  const iAmReviewer = sel && user.role !== "teacher" && teacherSide;
  const reviewed = sel && (sel.hasReview || myReviews[sel._id]);
  const contact = sel && (box === "sent" ? sel.toContact : sel.fromContact);
  const history = sel
    ? [
        [box === "sent" ? "Sent" : "Received", sel.createdAt],
        ...(sel.respondedAt ? [[sel.status === "declined" ? "Declined" : "Accepted", sel.respondedAt]] : []),
        ...(sel.status === "completed" ? [["Marked completed", sel.updatedAt]] : []),
        ...(reviewed ? [["Review left", null]] : []),
      ]
    : [];

  return (
    <div className="shell flex flex-col gap-[22px] pb-24 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{user.role}</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>Interests</h1>
        </div>
        <div className="seg rounded-[10px] p-1" role="tablist">
          {[["received", "Received"], ["sent", "Sent"]].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={box === k}
              className={`seg-item flex items-center gap-2 px-[18px] py-[9px] text-[15px] ${box === k ? "on" : ""}`}
              onClick={() => { setParams({ tab: k }); setFilter("all"); setSelId(null); setDeclining(false); }}
            >
              {label}
              {k === "received" && pendingReceived > 0 && <span className="min-w-5 rounded-[10px] bg-primary px-1.5 py-px text-center text-[11px] text-white">{pendingReceived}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={filter === k} className={`chip font-semibold ${filter === k ? "on" : ""}`} onClick={() => { setFilter(k); setSelId(null); }}>
            {label} · {k === "all" ? inBox.length : inBox.filter((i) => i.status === k).length}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="card min-w-0 overflow-hidden rounded-[18px]" style={{ flex: "1 1 340px", maxWidth: 440 }}>
          {list.length === 0 ? (
            <EmptyState
              icon="users"
              title="Nothing here"
              action={box === "sent" && user.role !== "teacher" ? <Link to="/browse" className="btn btn-primary btn-sm">Browse teachers</Link> : null}
            >
              {box === "sent"
                ? user.role === "teacher" ? "Interests you send on students' wanted ads appear here." : "No interests sent yet — browse teachers to get started."
                : user.role === "teacher" ? "No requests yet. Requests from students and parents appear here." : "Teachers who respond to your wanted ads appear here."}
            </EmptyState>
          ) : (
            list.map((i) => {
              const p = otherParty(i, box);
              const on = sel && i._id === sel._id;
              return (
                <button
                  key={i._id}
                  type="button"
                  onClick={() => { setSelId(i._id); setDeclining(false); }}
                  className="divider-row relative flex w-full items-start gap-3.5 border-0 px-[18px] py-4 text-left hover:bg-tint"
                  style={{ background: on ? "var(--page)" : "#fff" }}
                >
                  {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                  <Avatar name={p.name} src={p.raw?.photoUrl} size={42} />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2.5">
                      <span className="serif truncate text-[17px] font-bold">{p.name}</span>
                      <span className="whitespace-nowrap text-xs text-ink-2">{relativeTime(i.createdAt)}</span>
                    </span>
                    <span className="truncate text-[13px] text-ink-2">{i.listing ? `${i.listing.subject} · ${i.listing.grade}` : "Listing"}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={i.status} className="text-[11px]" />
                      {(p.childOfOther || p.child) && (
                        <span className="status status-muted text-[11px]">For child · {p.childOfOther || p.child}</span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </section>

        {sel && (
          <section className="card rise sticky top-[104px] flex min-w-0 flex-col gap-[22px] rounded-[18px] p-7" style={{ flex: "999 1 480px" }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={party.name} src={party.raw?.photoUrl} size={60} solid />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="serif text-[28px] leading-tight">{party.name}</span>
                  <span className="text-sm text-ink-2">{party.sub}</span>
                </div>
              </div>
              <StatusBadge status={sel.status} />
            </div>

            {sel.listing && (
              <Link to={`/listings/${sel.listing._id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-page px-4 py-3.5 text-ink hover:border-lavender hover:text-ink">
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="eyebrow-muted text-xs">Listing</span>
                  <span className="serif text-[17px] font-bold">{sel.listing.subject} · {sel.listing.grade}</span>
                </span>
                <span className="whitespace-nowrap text-sm font-semibold text-primary">{formatPrice(sel.listing.price) || "View"} →</span>
              </Link>
            )}

            <div className="flex flex-col gap-2">
              <span className="eyebrow-muted text-xs">{box === "sent" ? "Your message" : "Their message"}</span>
              <div className="serif whitespace-pre-line rounded-xl bg-mist px-[18px] py-4 text-[17px] leading-relaxed">{sel.message}</div>
              <span className="text-xs text-ink-2">Sent {formatDateTime(sel.createdAt)}</span>
            </div>

            {contact && (sel.status === "accepted" || sel.status === "completed") && (
              <div className="flex flex-col gap-2 rounded-xl border px-4 py-3.5" style={{ borderColor: "var(--lavender)" }}>
                <span className="eyebrow-muted text-xs">Contact details</span>
                <span className="text-[15px] font-semibold">{contact.name}</span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                  <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                </span>
                <span className="text-xs text-ink-2">Shared because this request was accepted. Keep payments on EduLink.</span>
              </div>
            )}

            {box === "received" && sel.status === "pending" && (
              <div className="flex flex-col gap-3 border-t border-mist pt-[18px]">
                {blocked && (
                  <div className="flex items-start gap-3 rounded-xl border px-4 py-3.5" style={{ background: "var(--danger-soft)", borderColor: "#E8B4B0" }}>
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-danger text-[13px] font-bold text-white">!</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold">You can't accept requests for children yet</span>
                      <span className="text-[13px] leading-normal text-ink-2">
                        This request involves a child account. Only fully verified teachers can accept it. <Link to="/verification" className="font-semibold">Add your police clearance →</Link>
                      </span>
                    </div>
                  </div>
                )}
                {declining && (
                  <span className="rise text-sm text-ink-2">
                    Declining lets {firstName(party.name)} know you can't take this on. They'll be notified — this can't be undone.
                  </span>
                )}
                <div className="flex flex-wrap justify-end gap-2.5">
                  {declining ? (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => setDeclining(false)}>Cancel</button>
                      <button type="button" className="btn btn-danger" disabled={busy} onClick={() => respond("declined")}>{busy && <Spinner />} Confirm decline</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn btn-soft" onClick={() => setDeclining(true)}>Decline</button>
                      <button
                        type="button"
                        className="btn btn-primary px-6"
                        disabled={busy || blocked}
                        title={blocked ? "Only fully verified teachers can accept requests for child accounts" : undefined}
                        onClick={() => respond("accepted")}
                      >
                        {busy && <Spinner dark={false} />} Accept
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {box === "sent" && sel.status === "pending" && (
              <div className="flex items-center gap-2 border-t border-mist pt-[18px] text-sm text-ink-2">
                <span className="h-2 w-2 rounded-full bg-blue" />
                Waiting for {firstName(party.name)} to reply. Most teachers reply within 2 days.
              </div>
            )}

            {sel.status === "accepted" && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-[18px]">
                <span className="text-sm text-ink-2">
                  {box === "sent" ? `${firstName(party.name)} accepted. Chat to agree details, then book a slot.` : "Accepted. You can now chat and book a trial class."}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {sel.conversationId && <Link to={`/chat/${sel.conversationId}`} className="btn btn-outline">Open chat</Link>}
                  {teacherSide && (
                    <button type="button" className="btn btn-primary" onClick={() => setBooking(sel)}>Book a trial class</button>
                  )}
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={complete}>Mark completed</button>
                </div>
              </div>
            )}

            {sel.status === "declined" && box === "sent" && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-[18px]">
                <span className="text-sm text-ink-2">No worries — there are other teachers who match what you need.</span>
                <Link to={sel.listing ? `/browse?subject=${encodeURIComponent(sel.listing.subject)}` : "/browse"} className="btn btn-primary">Find similar teachers</Link>
              </div>
            )}

            {sel.status === "completed" && iAmReviewer && !reviewed && (
              <ReviewForm interest={sel} teacherName={teacherSide.name} onDone={(r) => setMyReviews((m) => ({ ...m, [sel._id]: r }))} />
            )}
            {sel.status === "completed" && reviewed && (
              <div className="flex items-center gap-2.5 rounded-[14px] border px-5 py-4 text-sm" style={{ borderColor: "var(--lavender)" }}>
                <span className="text-primary">★</span> {user.role === "teacher" ? "The student left a review for this class." : "You reviewed this class. Thank you!"}
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-1.5">
              <span className="eyebrow-muted text-xs">History</span>
              <div className="flex flex-col">
                {history.map(([label, when], i) => (
                  <div key={label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-[5px] h-2.5 w-2.5 flex-none rounded-full" style={{ background: i === history.length - 1 ? "var(--primary)" : "var(--lavender)" }} />
                      {i < history.length - 1 && <span className="min-h-3.5 w-[1.5px] flex-1 bg-line" />}
                    </div>
                    <div className="flex flex-1 flex-wrap justify-between gap-3 pb-3 text-sm">
                      <span>{label}</span>
                      {when && <span className="text-ink-2">{formatDateTime(when)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {booking && (
        <BookingModal
          open
          onClose={() => setBooking(null)}
          interest={booking}
          teacherId={teacherSide?._id}
          teacherName={teacherSide?.name}
        />
      )}
    </div>
  );
};

export default InterestsPage;
