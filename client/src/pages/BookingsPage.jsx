import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, Modal, PageLoader, Spinner, StatusBadge } from "../components/ui/index.jsx";
import BookingModal from "../components/BookingModal.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import useNow from "../hooks/useNow.js";
import { bookingsApi, interestsApi, paymentsApi } from "../api/endpoints.js";
import { apiError, formatDate, formatMinorAmount, formatTime } from "../lib/format.js";

const TABS = [
  ["upcoming", "Upcoming"],
  ["past", "Past"],
  ["cancelled", "Cancelled"],
  ["payments", "Payments"],
];

const BookingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bookingId } = useParams();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("upcoming");
  const [banner, setBanner] = useState(params.get("payment"));
  const [cancelTarget, setCancelTarget] = useState(null);
  const [paying, setPaying] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [bookFor, setBookFor] = useState(null);

  // Re-fetched on load, so the badge reflects the webhook's result rather than the URL param.
  const { data, loading, reload, setData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);
  const { data: accepted } = useAsync(
    () =>
      Promise.all([interestsApi.sent({ limit: 50 }), interestsApi.received({ limit: 50 })]).then(([s, r]) =>
        [...s.interests, ...r.interests].filter((i) => i.status === "accepted")
      ),
    []
  );

  useEffect(() => {
    if (params.get("payment")) {
      // The banner was seeded from this param on mount; drop it from the
      // URL so a refresh doesn't show the banner again.
      const next = new URLSearchParams(params);
      next.delete("payment");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  const myIds = useMemo(() => new Set([String(user._id), ...(user.linkedChildIds || []).map((c) => String(c._id))]), [user]);
  const bookings = useMemo(() => data?.bookings || [], [data]);
  const now = useNow();
  const lists = {
    upcoming: bookings.filter((b) => b.status === "confirmed" && new Date(b.endTime).getTime() > now).sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    past: bookings.filter((b) => b.status === "completed" || (b.status === "confirmed" && new Date(b.endTime).getTime() <= now)).sort((a, b) => new Date(b.startTime) - new Date(a.startTime)),
    cancelled: bookings.filter((b) => b.status === "cancelled"),
  };
  const returned = bookingId && bookings.find((b) => b._id === bookingId);

  const isStudentSide = (b) => myIds.has(String(b.studentId));
  const otherName = (b) => (isStudentSide(b) ? b.teacher?.name : b.student?.isChild ? `${b.student.name} (${b.student.parentName || "parent"})` : b.student?.name) || "—";

  const patch = (booking) =>
    setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b._id === booking._id ? { ...b, status: booking.status } : b)) }));

  const cancel = async () => {
    setBusy(true);
    try {
      const { booking } = await bookingsApi.cancel(cancelTarget._id);
      patch(booking);
      toast.success("Class cancelled. The other side has been notified in their bookings.");
      setCancelTarget(null);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const complete = async (b) => {
    try {
      const { booking } = await bookingsApi.complete(b._id);
      patch(booking);
      toast.success("Marked as completed.");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const pay = async (b) => {
    setPaying(b._id);
    try {
      const { checkoutUrl } = await paymentsApi.checkout(b._id);
      window.location.assign(checkoutUrl);
    } catch (err) {
      toast.error(apiError(err, "Couldn't start the payment."));
      setPaying(null);
    }
  };

  if (loading) return <PageLoader />;

  const list = lists[tab] || [];
  const paid = bookings.filter((b) => b.payment?.status === "paid");
  const due = lists.upcoming.filter((b) => isStudentSide(b) && b.payment?.status !== "paid");
  const currency = paid[0]?.payment?.currency || "usd";

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-6 px-[clamp(16px,3vw,32px)] pb-24 pt-8">
      {banner === "success" && (
        <div className="rise flex flex-wrap items-center gap-4 rounded-[14px] bg-primary px-[22px] py-[18px] text-white">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-bold text-primary">✓</span>
          <div className="flex flex-col gap-[3px]" style={{ flex: "1 1 300px" }}>
            <span className="serif text-[21px]">Payment successful</span>
            <span className="text-sm text-mist">
              {returned?.payment?.status === "paid"
                ? `Deposit received for ${returned.listing?.subject || "your class"} with ${returned.teacher?.name || "your teacher"}.`
                : "We're confirming your deposit with our payment partner — the badge updates within a minute."}
            </span>
          </div>
          {returned?.payment?.status !== "paid" && <button type="button" className="btn btn-light btn-sm" onClick={reload}>Refresh</button>}
          <button type="button" aria-label="Dismiss" className="border-0 bg-transparent text-lavender" onClick={() => setBanner(null)}>✕</button>
        </div>
      )}
      {banner === "cancelled" && (
        <div className="rise flex flex-wrap items-center gap-4 rounded-[14px] border px-[22px] py-[18px]" style={{ background: "var(--mist)", borderColor: "var(--lavender)" }}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary font-bold text-white">i</span>
          <div className="flex flex-col gap-[3px]" style={{ flex: "1 1 300px" }}>
            <span className="serif text-[21px]">Payment wasn't completed</span>
            <span className="text-sm text-ink-2">No money was taken. You can pay the deposit anytime before the class.</span>
          </div>
          {returned && returned.status === "confirmed" && <button type="button" className="btn btn-primary btn-sm" onClick={() => pay(returned)}>Try again</button>}
          <button type="button" aria-label="Dismiss" className="border-0 bg-transparent text-ink-2" onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{user.role}</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>My bookings</h1>
        </div>
        <button type="button" className="btn btn-primary rounded-[10px] px-[22px] py-[13px]" onClick={() => setPickOpen(true)}>+ Book a class</button>
      </div>

      <div className="tabs no-scrollbar" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
            {label}
            {k !== "payments" && lists[k].length > 0 && <span className="tab-count" style={tab === k ? { background: "var(--primary)", color: "#fff" } : undefined}>{lists[k].length}</span>}
          </button>
        ))}
      </div>

      {tab === "payments" ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            {[
              ["Deposits paid", formatMinorAmount(paid.reduce((n, b) => n + (b.payment.amount || 0), 0), currency), "var(--ink)"],
              ["Paid bookings", paid.length, "var(--primary)"],
              ["Deposits due now", due.length, due.length ? "var(--danger)" : "var(--ink)"],
            ].map(([l, v, c]) => (
              <div key={l} className="card flex flex-col gap-1.5 rounded-[14px] px-5 py-[18px]">
                <span className="text-[13px] text-ink-2">{l}</span>
                <span className="serif text-[30px] leading-none" style={{ color: c }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid gap-3 border-b border-line px-5 py-3 text-xs font-bold tracking-[.08em] text-ink-2" style={{ gridTemplateColumns: "120px minmax(0,2fr) minmax(0,1fr) 110px 120px" }}>
                <span>DATE</span><span>CLASS</span><span>WITH</span><span className="text-right">AMOUNT</span><span>STATUS</span>
              </div>
              {bookings.filter((b) => b.payment).length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-2">No deposit payments yet.</div>}
              {bookings
                .filter((b) => b.payment)
                .map((b) => (
                  <div key={b._id} className="divider-row grid items-center gap-3 px-5 py-3.5 text-sm" style={{ gridTemplateColumns: "120px minmax(0,2fr) minmax(0,1fr) 110px 120px" }}>
                    <span className="text-ink-2">{formatDate(b.payment.paidAt || b.startTime)}</span>
                    <span className="truncate font-semibold">Deposit · {b.listing?.subject || "Class"}, {formatDate(b.startTime, { day: "numeric", month: "short" })}</span>
                    <span className="truncate text-ink-2">{otherName(b)}</span>
                    <span className="serif text-right text-[17px]">{formatMinorAmount(b.payment.amount, b.payment.currency)}</span>
                    <StatusBadge status={b.payment.status} className="justify-self-start" />
                  </div>
                ))}
            </div>
          </div>
          <span className="text-[13px] text-ink-2">Deposits are paid through EduLink's secure payment partner (Stripe). The rest of the fee is paid to your teacher as agreed.</span>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {list.map((b) => {
            const start = new Date(b.startTime);
            const upcoming = tab === "upcoming";
            const mineToPay = isStudentSide(b) && upcoming && b.payment?.status !== "paid";
            const hoursAway = (start.getTime() - now) / 3600000;
            const highlight = b._id === bookingId;
            return (
              <div
                key={b._id}
                className="flex flex-wrap overflow-hidden rounded-2xl border bg-white"
                style={{ borderColor: highlight ? "var(--primary)" : mineToPay ? "#E8B4B0" : "var(--line)", opacity: b.status === "cancelled" ? 0.7 : 1, boxShadow: highlight ? "0 0 0 3px rgba(61,82,160,.15)" : "none" }}
              >
                <div
                  className="flex flex-col items-center justify-center gap-0.5 px-2.5 py-[18px]"
                  style={{ flex: "0 0 108px", background: upcoming ? "var(--primary)" : "var(--line-soft)", color: upcoming ? "#fff" : "var(--ink-2)" }}
                >
                  <span className="text-xs font-bold tracking-[.12em]">{start.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                  <span className="serif text-[40px] leading-none">{start.getDate()}</span>
                  <span className="text-xs font-semibold">{start.toLocaleDateString("en-GB", { month: "short" })}</span>
                </div>
                <div className="flex min-w-0 flex-col gap-2 px-[22px] py-[18px]" style={{ flex: "1 1 320px" }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={b.status === "confirmed" && !upcoming ? "completed" : b.status} label={b.status === "confirmed" && !upcoming ? "Awaiting completion" : undefined} />
                    {b.status !== "cancelled" && isStudentSide(b) && <StatusBadge status={b.payment?.status === "paid" ? "paid" : "unpaid"} label={b.payment?.status === "paid" ? "Deposit paid" : "Deposit unpaid"} />}
                    {upcoming && hoursAway < 48 && <span className="text-xs font-semibold text-primary">{hoursAway < 24 ? "Within 24 hours" : "Tomorrow"}</span>}
                  </div>
                  <span className="serif text-xl font-bold leading-tight">{b.listing ? `${b.listing.subject} · ${b.listing.grade}` : "Trial class"}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-2">
                    <span>{formatTime(b.startTime)} – {formatTime(b.endTime)}</span>
                    <span className="flex items-center gap-1.5">
                      <Avatar name={otherName(b)} src={isStudentSide(b) ? b.teacher?.photoUrl : null} size={20} />
                      with {otherName(b)}
                    </span>
                    {!isStudentSide(b) && b.student?.isChild && <span>Child account</span>}
                  </div>
                  {b.notes && <span className="text-[13px] italic text-ink-2">“{b.notes}”</span>}
                  {mineToPay && <span className="text-[13px] text-danger">Pay the deposit before the class to keep your slot.</span>}
                </div>
                <div className="flex flex-col justify-center gap-2 border-l border-mist px-5 py-[18px]" style={{ flex: "0 1 250px" }}>
                  {mineToPay && (
                    <button type="button" className="btn btn-primary btn-sm" disabled={paying === b._id} onClick={() => pay(b)}>
                      {paying === b._id && <Spinner dark={false} />} {paying === b._id ? "Redirecting…" : "Pay deposit"}
                    </button>
                  )}
                  {upcoming && <button type="button" className="btn btn-soft btn-sm" onClick={() => navigate("/chat")}>Message</button>}
                  {b.status === "confirmed" && !upcoming && <button type="button" className="btn btn-primary btn-sm" onClick={() => complete(b)}>Mark completed</button>}
                  {upcoming && <button type="button" className="btn btn-danger btn-sm" onClick={() => setCancelTarget(b)}>Cancel</button>}
                  {b.status === "completed" && isStudentSide(b) && <Link to="/interests?tab=sent" className="btn btn-soft btn-sm">Leave a review</Link>}
                  {b.status !== "confirmed" && b.teacher && isStudentSide(b) && <Link to={`/teachers/${b.teacher._id}`} className="btn btn-ghost btn-sm">Book again</Link>}
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--lavender)" }}>
              <span className="serif text-[26px]">{{ upcoming: "No upcoming classes", past: "No past classes yet", cancelled: "Nothing cancelled" }[tab]}</span>
              <span className="text-sm text-ink-2">{tab === "upcoming" ? "Book a class with someone whose interest was accepted." : "Classes will show up here."}</span>
              {tab === "upcoming" && <button type="button" className="btn btn-primary btn-sm mt-1" onClick={() => setPickOpen(true)}>Book a class</button>}
            </div>
          )}
        </section>
      )}

      <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} width={440}>
        {cancelTarget && (
          <div className="flex flex-col gap-3.5 p-7">
            <span className="serif text-[28px] leading-tight">Cancel this class?</span>
            <span className="text-[15px] leading-normal text-ink-2">
              {formatDate(cancelTarget.startTime, { weekday: "long", day: "numeric", month: "long" })} at {formatTime(cancelTarget.startTime)} with {otherName(cancelTarget)}.
              The slot opens up again and this affects them too.
              {cancelTarget.payment?.status === "paid" ? " Contact support about refunding the paid deposit." : ""}
            </span>
            <div className="mt-1.5 flex justify-end gap-2.5">
              <button type="button" className="btn btn-soft" onClick={() => setCancelTarget(null)}>Keep booking</button>
              <button type="button" className="btn bg-danger text-white hover:opacity-90" disabled={busy} onClick={cancel}>{busy && <Spinner dark={false} />} Cancel class</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={pickOpen} onClose={() => setPickOpen(false)} title="Book a class" width={560}>
        <div className="flex flex-col gap-3 p-6">
          <span className="text-sm text-ink-2">Only requests that were accepted can be booked.</span>
          {(accepted || []).length === 0 ? (
            <div className="rounded-xl bg-mist px-4 py-4 text-sm">
              Nothing to book yet. <Link to={user.role === "teacher" ? "/interests?tab=received" : "/browse"} className="font-semibold">{user.role === "teacher" ? "Review your requests" : "Find a teacher"}</Link> first.
            </div>
          ) : (
            accepted.map((i) => {
              const teacher = i.fromUser?.role === "teacher" ? i.fromUser : i.toUser;
              const other = teacher && String(teacher._id) === String(user._id) ? (i.fromUser?.role === "teacher" ? i.toUser : i.fromUser) : teacher;
              return (
                <button key={i._id} type="button" className="option" onClick={() => { setBookFor({ interest: i, teacher }); setPickOpen(false); }}>
                  <Avatar name={other?.name} src={other?.photoUrl} size={38} solid />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="serif text-base font-bold">{other?.isChild ? `${other.parentName} (for ${other.name})` : other?.name}</span>
                    <span className="text-xs text-ink-2">{i.listing ? `${i.listing.subject} · ${i.listing.grade}` : ""}</span>
                  </span>
                  <span className="text-sm font-semibold text-primary">Choose →</span>
                </button>
              );
            })
          )}
        </div>
      </Modal>

      {bookFor && (
        <BookingModal
          open
          onClose={() => setBookFor(null)}
          interest={bookFor.interest}
          teacherId={bookFor.teacher?._id}
          teacherName={bookFor.teacher?.name}
          onBooked={() => reload()}
        />
      )}
    </div>
  );
};

export default BookingsPage;
