import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Icon from "../components/ui/Icon.jsx";
import { PageLoader, Spinner } from "../components/ui/index.jsx";
import useAuth from "../hooks/useAuth.js";
import { notificationsApi } from "../api/endpoints.js";
import { NOTIFICATION_ICON, notificationLink, notificationText } from "../lib/notifications.js";
import { apiError, formatTime, relativeTime } from "../lib/format.js";

const PAGE = 20;

const CATEGORY = {
  interest_received: "interests",
  interest_accepted: "interests",
  interest_declined: "interests",
  interest_completed: "interests",
  new_review: "reviews",
  listing_flagged: "listings",
};
const CATS = [
  ["all", "All"],
  ["interests", "Interests"],
  ["reviews", "Reviews"],
  ["listings", "Listings"],
];
const CTA = {
  interest_received: "Review request",
  interest_accepted: "Open interests",
  interest_completed: "Leave a review",
  new_review: "See your reviews",
  listing_flagged: "View listing",
};

const dayGroup = (date) => {
  const d = new Date(date);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start - d) / 86400000) + 1;
  if (d >= start) return "Today";
  if (diffDays <= 1) return "Yesterday";
  if (diffDays < 7) return "Earlier this week";
  return "Older";
};

const NotificationsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cat, setCat] = useState("all");
  const [view, setView] = useState("all");

  const apply = useCallback((p, data) => {
    setItems((prev) => (p === 1 ? data.notifications : [...prev, ...data.notifications]));
    setTotal(data.pagination.total);
    setUnread(data.unreadCount);
    setPage(p);
  }, []);
  const load = useCallback((p) => notificationsApi.list({ page: p, limit: PAGE }).then((data) => apply(p, data)), [apply]);

  useEffect(() => {
    notificationsApi
      .list({ page: 1, limit: PAGE })
      .then((data) => apply(1, data))
      .catch((err) => toast.error(apiError(err)))
      .finally(() => setLoading(false));
  }, [apply]);

  const markAll = async () => {
    if (!unread) return;
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(apiError(err));
      load(1);
    }
  };

  const open = (n) => {
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(n._id).catch(() => {});
    }
    navigate(notificationLink(n, user));
  };

  if (loading) return <PageLoader />;

  const list = items.filter((n) => (cat === "all" || CATEGORY[n.type] === cat) && (view === "all" || !n.read));
  const groups = [];
  list.forEach((n) => {
    const g = dayGroup(n.createdAt);
    const existing = groups.find((x) => x.label === g);
    if (existing) existing.items.push(n);
    else groups.push({ label: g, items: [n] });
  });
  const catUnread = (k) => items.filter((n) => !n.read && (k === "all" || CATEGORY[n.type] === k)).length;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-start gap-9 px-[clamp(16px,3vw,32px)] pb-24 pt-9">
      <aside className="flex flex-col gap-[18px] md:sticky md:top-[104px]" style={{ flex: "1 1 220px", maxWidth: 260 }}>
        <h1 style={{ font: "400 clamp(34px,3.6vw,44px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>Notifications</h1>
        <nav className="flex flex-col gap-0.5" aria-label="Categories">
          {CATS.map(([k, label]) => {
            const on = cat === k;
            const n = k === "all" ? unread : catUnread(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setCat(k)}
                aria-current={on ? "true" : undefined}
                className="flex items-center justify-between rounded-[10px] border-0 px-3.5 py-2.5 text-left text-[15px] hover:bg-mist"
                style={{ fontWeight: on ? 700 : 500, color: on ? "var(--primary)" : "var(--ink)", background: on ? "var(--mist)" : "transparent" }}
              >
                {label}
                {n > 0 && <span className="min-w-[22px] rounded-[10px] bg-primary px-[7px] py-px text-center text-[11px] font-bold text-white">{n}</span>}
              </button>
            );
          })}
        </nav>
        <div className="card-mist flex flex-col gap-2 rounded-[14px] px-[18px] py-4 text-sm leading-normal">
          <span className="serif text-base font-bold">Also by email</span>
          <span className="text-ink-2">Every notification is also emailed to {user.email}. Chat messages arrive live in Chat.</span>
        </div>
      </aside>

      <section className="flex min-w-0 flex-col gap-[18px]" style={{ flex: "999 1 520px" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="seg rounded-[10px] p-1" role="tablist">
            {[["all", "All"], ["unread", `Unread (${unread})`]].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} className={`seg-item px-4 py-2 text-sm ${view === k ? "on" : ""}`} onClick={() => setView(k)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" onClick={markAll} disabled={!unread} className="border-0 bg-transparent text-sm font-semibold disabled:cursor-default" style={{ color: unread ? "var(--primary)" : "var(--lavender)" }}>
            Mark all as read
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2">
            <span className="eyebrow-muted px-1">{g.label}</span>
            <div className="card overflow-hidden">
              {g.items.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => open(n)}
                  className="divider-row relative flex w-full items-start gap-3.5 border-0 px-5 py-[18px] text-left hover:bg-tint"
                  style={{ background: n.read ? "#fff" : "var(--page)" }}
                >
                  {!n.read && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                  <span
                    className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full"
                    style={{ background: n.read ? "var(--mist)" : "var(--primary)", color: n.read ? "var(--primary)" : "#fff" }}
                  >
                    <Icon name={NOTIFICATION_ICON[n.type] || "bell"} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="text-[15px] leading-snug text-ink" style={{ fontWeight: n.read ? 400 : 600 }}>{notificationText(n)}.</span>
                    <span className="flex flex-wrap items-center gap-2.5 text-[13px] text-ink-2">
                      <span>{g.label === "Today" ? `${relativeTime(n.createdAt)}` : `${relativeTime(n.createdAt)} · ${formatTime(n.createdAt)}`}</span>
                      <span className="h-[3px] w-[3px] rounded-full bg-lavender" />
                      <span className="capitalize">{CATEGORY[n.type] || "General"}</span>
                    </span>
                    {CTA[n.type] && (
                      <span
                        className="mt-1 self-start rounded-lg border-[1.5px] border-primary px-3.5 py-2 text-[13px] font-semibold"
                        style={{ background: n.read ? "#fff" : "var(--primary)", color: n.read ? "var(--primary)" : "#fff" }}
                      >
                        {CTA[n.type]}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed bg-white px-8 py-14 text-center" style={{ borderColor: "var(--lavender)" }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mist text-primary"><Icon name="bell" size={26} /></span>
            <span className="serif text-[26px]">{view === "unread" || items.length ? "You're all caught up" : "Nothing here yet"}</span>
            <span className="text-[15px] text-ink-2">{view === "unread" ? "No unread notifications." : "Notifications in this category will show up here."}</span>
          </div>
        )}

        {items.length < total && (
          <button
            type="button"
            className="btn btn-soft self-center"
            disabled={loadingMore}
            onClick={async () => {
              setLoadingMore(true);
              try {
                await load(page + 1);
              } catch (err) {
                toast.error(apiError(err));
              } finally {
                setLoadingMore(false);
              }
            }}
          >
            {loadingMore && <Spinner />} Load older notifications
          </button>
        )}
      </section>
    </div>
  );
};

export default NotificationsPage;
