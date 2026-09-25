import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../ui/Icon.jsx";
import { notificationsApi } from "../../api/endpoints.js";
import { notificationLink, notificationText } from "../../lib/notifications.js";
import { relativeTime } from "../../lib/format.js";
import useAuth from "../../hooks/useAuth.js";
import useClickOutside from "../../hooks/useClickOutside.js";

const POLL_MS = 45_000; // spec §3.2: polling, not real-time

const NotificationBell = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const load = useCallback(
    () =>
      notificationsApi
        .list({ limit: 6 })
        .then((data) => {
          setItems(data.notifications);
          setUnread(data.unreadCount);
        })
        // Non-critical chrome — a failed poll just keeps the last known state.
        .catch(() => {}),
    []
  );

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const markAll = async () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      load();
    }
  };

  const openItem = async (n) => {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      notificationsApi.markRead(n._id).catch(() => {});
    }
    navigate(notificationLink(n, user));
  };

  return (
    <div className="relative flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative flex items-center justify-center rounded-full bg-white text-ink transition-colors hover:border-primary"
        style={{
          width: 42, height: 42, border: "1px solid var(--mist)",
          boxShadow: "0 1px 2px rgba(22,27,63,.05), 0 6px 16px -8px rgba(61,82,160,.35)",
        }}
      >
        <Icon name="bell" size={20} strokeWidth={1.5} />
        {unread > 0 && (
          <span
            className="absolute flex items-center justify-center rounded-[9px] bg-primary px-[5px] text-[10px] font-bold text-white"
            style={{ top: -3, right: -3, minWidth: 18, height: 18, border: "2px solid #fff", boxShadow: "0 3px 8px -2px rgba(61,82,160,.55)" }}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="popover absolute right-0 z-50 overflow-hidden" style={{ top: 52, width: 360, maxWidth: "calc(100vw - 32px)" }}>
          <div className="flex items-center justify-between border-b border-mist px-[18px] py-4">
            <span className="serif text-lg font-bold">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="border-0 bg-transparent text-[13px] font-semibold text-primary">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-ink-2">You're all caught up.</div>
          ) : (
            items.map((n) => (
              <button
                type="button"
                key={n._id}
                onClick={() => openItem(n)}
                className="flex w-full gap-3 border-0 border-b border-line-soft px-[18px] py-3.5 text-left hover:bg-tint"
                style={{ background: n.read ? "#fff" : "var(--page)" }}
              >
                <span className="mt-[7px] h-2 w-2 flex-none rounded-full" style={{ background: n.read ? "var(--line)" : "var(--primary)" }} />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm leading-snug" style={{ fontWeight: n.read ? 400 : 600 }}>
                    {notificationText(n)}
                  </span>
                  <span className="text-xs text-ink-2">{relativeTime(n.createdAt)}</span>
                </span>
              </button>
            ))
          )}
          <Link to="/notifications" onClick={() => setOpen(false)} className="block p-3.5 text-center text-sm font-semibold">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
