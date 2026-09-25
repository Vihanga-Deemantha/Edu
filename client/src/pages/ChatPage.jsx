import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Icon from "../components/ui/Icon.jsx";
import { Avatar, PageLoader, Spinner, VerifiedBadge } from "../components/ui/index.jsx";
import ReportModal from "../components/ReportModal.jsx";
import useAuth from "../hooks/useAuth.js";
import useAsync from "../hooks/useAsync.js";
import { chatApi } from "../api/endpoints.js";
import { connectChatSocket, sendChatMessage } from "../lib/socket.js";
import { formatTime, relativeTime } from "../lib/format.js";

const CONTACT_PATTERN = /(\+?94|0)\s?7\d[\s-]?\d{3}[\s-]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+/;
const PAGE = 30;

const dayLabel = (date) => {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "TODAY";
  if (d.toDateString() === yesterday.toDateString()) return "YESTERDAY";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
};

const ChatPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [showInfo, setShowInfo] = useState(() => window.innerWidth >= 1200);
  const [report, setReport] = useState(false);

  const { data: convData, loading: convLoading, setData: setConvData } = useAsync(() => chatApi.conversations(), []);
  const conversations = useMemo(() => convData?.conversations || [], [convData]);
  const active = conversations.find((c) => c._id === conversationId);

  // Messages for the open conversation (newest page first, older pages prepended).
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [threadState, setThreadState] = useState(conversationId ? "loading" : "idle"); // idle | loading | ready | forbidden | error
  const [draft, setDraft] = useState("");
  const socketRef = useRef(null);
  const threadRef = useRef(null);
  const stickToBottom = useRef(true);
  const tempSeq = useRef(0);
  // Which thread is on screen — live messages for other conversations only
  // update the list preview, never the open thread.
  const activeCid = useRef(conversationId);
  useLayoutEffect(() => {
    activeCid.current = conversationId;
  }, [conversationId]);
  // Clear the thread as soon as another conversation is opened.
  const [shownCid, setShownCid] = useState(conversationId);
  if (shownCid !== conversationId) {
    setShownCid(conversationId);
    setMessages([]);
    setThreadState(conversationId ? "loading" : "idle");
  }

  // One socket per chat screen; new_message appends live to whichever thread it belongs to.
  useEffect(() => {
    const socket = connectChatSocket();
    socketRef.current = socket;
    socket.on("new_message", ({ conversationId: cid, message }) => {
      setConvData((d) =>
        d
          ? {
              ...d,
              conversations: d.conversations
                .map((c) => (c._id === cid ? { ...c, lastMessage: { text: message.text, senderId: message.senderId, createdAt: message.createdAt }, lastMessageAt: message.createdAt } : c))
                .sort((a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)),
            }
          : d
      );
      if (cid === activeCid.current) {
        setMessages((list) => (list.some((m) => m._id === message._id) ? list : [...list, message]));
      }
    });
    return () => socket.disconnect();
  }, [setConvData]);

  const applyPage = useCallback((cid, p, data) => {
    setTotal(data.pagination.total);
    setPage(p);
    if (cid !== activeCid.current) return;
    setMessages((prev) => (p === 1 ? data.messages : [...data.messages, ...prev]));
  }, []);
  const loadPage = useCallback((cid, p) => chatApi.messages(cid, { page: p, limit: PAGE }).then((data) => applyPage(cid, p, data)), [applyPage]);

  useEffect(() => {
    if (!conversationId) return;
    stickToBottom.current = true;
    chatApi
      .messages(conversationId, { page: 1, limit: PAGE })
      .then((data) => {
        applyPage(conversationId, 1, data);
        setThreadState("ready");
      })
      .catch((err) => setThreadState([400, 403, 404].includes(err.response?.status) ? "forbidden" : "error"));
  }, [conversationId, applyPage]);

  // Default to the most recent conversation on wide screens.
  useEffect(() => {
    if (!conversationId && conversations.length && window.innerWidth >= 900) navigate(`/chat/${conversations[0]._id}`, { replace: true });
  }, [conversationId, conversations, navigate]);

  useEffect(() => {
    const el = threadRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (textArg) => {
    const text = (textArg ?? draft).trim();
    if (!text || !socketRef.current) return;
    tempSeq.current += 1;
    const tempId = `temp-${tempSeq.current}`;
    const optimistic = { _id: tempId, senderId: user._id, text, createdAt: new Date().toISOString(), pending: true };
    stickToBottom.current = true;
    setMessages((list) => [...list, optimistic]);
    setDraft("");
    const ack = await sendChatMessage(socketRef.current, conversationId, text);
    setMessages((list) => {
      if (ack?.success) {
        // The broadcast may have already appended the real message — keep one copy.
        const withoutTemp = list.filter((m) => m._id !== tempId);
        return withoutTemp.some((m) => m._id === ack.message._id) ? withoutTemp : [...withoutTemp, ack.message];
      }
      return list.map((m) => (m._id === tempId ? { ...m, pending: false, failed: ack?.error?.message || "Not delivered" } : m));
    });
  };

  const retry = (m) => {
    setMessages((list) => list.filter((x) => x._id !== m._id));
    send(m.text);
  };

  if (convLoading) return <PageLoader />;

  if (conversations.length === 0 && !conversationId) {
    return (
      <div className="flex flex-1 items-center justify-center px-8 py-20">
        <div className="flex max-w-[480px] flex-col items-center gap-3.5 text-center">
          <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-mist text-primary"><Icon name="chat" size={32} /></span>
          <h1 className="serif text-[34px] leading-tight">No conversations yet</h1>
          <p className="serif text-[17px] leading-normal text-ink-2">
            Chat opens automatically once an interest request is accepted. {user.role === "teacher" ? "Accept a request to start talking." : "Find a teacher, send an interest, and you'll be able to message here."}
          </p>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            {user.role !== "teacher" && <Link to="/browse" className="btn btn-primary">Find a teacher</Link>}
            <Link to="/interests" className="btn btn-outline">View my interests</Link>
          </div>
        </div>
      </div>
    );
  }

  const filtered = conversations.filter((c) => !q || `${c.otherParty?.name} ${c.listing?.subject} ${c.child?.name || ""}`.toLowerCase().includes(q.toLowerCase()));
  const other = active?.otherParty;
  const contactWarn = CONTACT_PATTERN.test(draft);

  // Group runs of messages by sender and day for bubble shapes/labels.
  const rendered = [];
  let lastDay = null;
  messages.forEach((m, i) => {
    const day = dayLabel(m.createdAt);
    if (day !== lastDay) {
      rendered.push({ type: "day", key: `d-${day}-${i}`, label: day });
      lastDay = day;
    }
    const prev = messages[i - 1];
    const next = messages[i + 1];
    const mine = String(m.senderId) === String(user._id);
    const cont = prev && String(prev.senderId) === String(m.senderId) && dayLabel(prev.createdAt) === day;
    const lastOfRun = !next || String(next.senderId) !== String(m.senderId) || dayLabel(next.createdAt) !== day;
    rendered.push({ type: "msg", key: m._id, m, mine, cont, lastOfRun });
  });

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-1" style={{ height: "calc(100vh - 80px)", minHeight: 520 }}>
      {/* Conversation list */}
      <aside className={`flex-col border-r border-line bg-white ${conversationId ? "hidden md:flex" : "flex"}`} style={{ flex: "0 1 320px", minWidth: 260 }}>
        <div className="flex flex-col gap-3.5 border-b border-line-soft px-5 pb-3.5 pt-[22px]">
          <h1 className="serif text-[32px] leading-none">Messages</h1>
          <label className="flex h-[42px] items-center gap-2.5 rounded-full border bg-page px-3.5" style={{ borderColor: "var(--lavender)" }}>
            <Icon name="search" size={17} strokeWidth={2} className="text-primary" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium outline-none" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const on = c._id === conversationId;
            const last = c.lastMessage;
            return (
              <Link
                key={c._id}
                to={`/chat/${c._id}`}
                className="relative flex items-center gap-3 border-b border-line-soft px-5 py-3.5 text-ink hover:bg-tint hover:text-ink"
                style={{ background: on ? "var(--page)" : "#fff" }}
              >
                {on && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                <Avatar name={c.otherParty?.name} src={c.otherParty?.photoUrl} size={46} solid={on} />
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="serif truncate text-base font-bold">{c.otherParty?.name || "Conversation"}</span>
                    <span className="whitespace-nowrap text-xs text-ink-2">{last ? relativeTime(last.createdAt) : ""}</span>
                  </div>
                  <span className="truncate text-xs font-semibold text-primary">
                    {c.listing ? `${c.listing.subject} · ${c.listing.grade}` : ""}
                    {c.child ? ` · for ${c.child.name}` : ""}
                  </span>
                  <span className="truncate text-[13px] text-ink-2">
                    {last ? `${String(last.senderId) === String(user._id) ? "You: " : ""}${last.text}` : "No messages yet — say hello"}
                  </span>
                </div>
              </Link>
            );
          })}
          {filtered.length === 0 && <div className="px-5 py-10 text-center text-sm text-ink-2">No conversations match “{q}”.</div>}
        </div>
      </aside>

      {/* Thread */}
      <section className={`min-w-0 flex-1 flex-col bg-page ${conversationId ? "flex" : "hidden md:flex"}`}>
        {!conversationId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-2">Choose a conversation.</div>
        ) : threadState === "forbidden" ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="card flex max-w-[500px] flex-col items-center gap-3.5 rounded-[20px] p-9 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mist text-primary"><Icon name="shield" size={28} /></span>
              <h1 className="serif text-[30px] leading-tight">You can't open this chat</h1>
              <p className="text-[15px] leading-normal text-ink-2">This conversation belongs to another account, or the link is out of date. If you're a parent, your children's chats are listed under your own account.</p>
              <Link to="/interests" className="btn btn-primary mt-1.5">Back to interests</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-none items-center gap-3.5 border-b border-line bg-white px-6 py-3.5">
              <Link to="/chat" className="btn btn-ghost -ml-3 p-2 md:hidden" aria-label="Back to conversations"><Icon name="arrowLeft" /></Link>
              <Avatar name={other?.name} src={other?.photoUrl} size={44} solid />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="serif whitespace-nowrap text-[19px] font-bold">{other?.name || "Conversation"}</span>
                  {other?.verificationStatus && <VerifiedBadge tier={other.verificationStatus} />}
                </div>
                <span className="truncate text-[13px] text-ink-2">
                  {active?.listing ? `${active.listing.subject} · ${active.listing.grade}` : ""}
                  {active?.child ? ` · for ${active.child.name}` : ""}
                </span>
              </div>
              <button type="button" onClick={() => setShowInfo((s) => !s)} className="btn btn-soft btn-sm hidden lg:inline-flex" style={{ background: showInfo ? "var(--mist)" : "#fff" }}>
                {showInfo ? "Hide details" : "Details"}
              </button>
            </div>

            <div
              ref={threadRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
              }}
              className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-[clamp(16px,3vw,40px)] py-6"
            >
              <div className="mb-3 self-center rounded-xl bg-mist px-4 py-2.5 text-center text-[13px] leading-normal" style={{ maxWidth: 520, color: "#2A3163" }}>
                Chat stays on EduLink until you're ready. Don't share bank details or pay outside the platform.
              </div>
              {messages.length < total && (
                <button
                  type="button"
                  className="btn btn-soft btn-sm self-center"
                  onClick={() => {
                    stickToBottom.current = false;
                    loadPage(conversationId, page + 1);
                  }}
                >
                  Load earlier messages
                </button>
              )}
              {threadState === "loading" && <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-2"><Spinner /> Loading messages…</div>}
              {threadState === "error" && <div className="py-8 text-center text-sm text-danger">Couldn't load messages. <button type="button" className="border-0 bg-transparent font-semibold text-primary" onClick={() => loadPage(conversationId, 1).then(() => setThreadState("ready"))}>Retry</button></div>}
              {threadState === "ready" && messages.length === 0 && (
                <div className="py-8 text-center text-sm text-ink-2">No messages yet. Say hello and agree on a first class.</div>
              )}
              {rendered.map((r) =>
                r.type === "day" ? (
                  <div key={r.key} className="mb-1.5 mt-3.5 self-center text-xs font-bold tracking-[.1em] text-ink-2">{r.label}</div>
                ) : (
                  <div key={r.key} className="flex flex-col gap-1" style={{ alignItems: r.mine ? "flex-end" : "flex-start", marginTop: r.cont ? 2 : 10 }}>
                    <div
                      className="whitespace-pre-wrap break-words border px-[15px] py-[11px] text-[15px] leading-normal"
                      style={{
                        maxWidth: "min(560px, 78%)",
                        borderRadius: r.mine ? (r.lastOfRun ? "16px 16px 4px 16px" : "16px 4px 4px 16px") : r.lastOfRun ? "16px 16px 16px 4px" : "4px 16px 16px 4px",
                        background: r.m.failed ? "var(--danger-soft)" : r.mine ? "var(--primary)" : "#fff",
                        color: r.m.failed ? "var(--ink)" : r.mine ? "#fff" : "var(--ink)",
                        borderColor: r.m.failed ? "#E8B4B0" : r.mine ? "var(--primary)" : "var(--line)",
                        opacity: r.m.pending ? 0.7 : 1,
                      }}
                    >
                      {r.m.text}
                    </div>
                    {(r.lastOfRun || r.m.failed || r.m.pending) && (
                      <span className="flex items-center gap-2 text-[11px]" style={{ color: r.m.failed ? "var(--danger)" : "var(--ink-2)" }}>
                        {r.m.pending ? "Sending…" : r.m.failed ? r.m.failed : formatTime(r.m.createdAt)}
                        {r.m.failed && (
                          <button type="button" onClick={() => retry(r.m)} className="border-0 bg-transparent p-0 font-bold text-primary">Retry</button>
                        )}
                      </span>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="flex flex-none flex-col gap-2.5 border-t border-line bg-white px-[clamp(16px,3vw,40px)] pb-[18px] pt-3.5">
              {contactWarn && (
                <div className="rise flex flex-wrap items-center gap-3 rounded-[10px] border px-3.5 py-2.5 text-[13px] leading-snug" style={{ background: "var(--danger-soft)", borderColor: "#E8B4B0" }}>
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-danger text-xs font-bold text-white">!</span>
                  <span style={{ flex: "1 1 260px" }}>It looks like you're sharing a phone number or email. For your safety, keep chatting here until a booking is confirmed.</span>
                </div>
              )}
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {(user.role === "teacher" ? ["When are you free?", "Let's book a trial class", "Please bring your past papers"] : ["When are you free?", "Can we book a trial class?", "What should I bring?"]).map((label) => (
                  <button key={label} type="button" className="chip flex-none" onClick={() => send(label)}>{label}</button>
                ))}
              </div>
              <form
                className="flex items-end gap-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  rows={1}
                  value={draft}
                  maxLength={2000}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Write a message…"
                  aria-label="Message"
                  className="min-w-0 flex-1 resize-none rounded-[14px] border-[1.5px] bg-page px-4 py-[13px] text-[15px] font-medium leading-snug outline-none focus:border-primary"
                  style={{ minHeight: 48, maxHeight: 140, borderColor: contactWarn ? "#E8B4B0" : "var(--lavender)" }}
                />
                <button type="submit" disabled={!draft.trim()} className="btn btn-primary h-12 flex-none rounded-[14px] px-[22px]">
                  <Icon name="send" size={16} /> Send
                </button>
              </form>
              <span className="text-[11px] text-ink-2">Enter to send · Shift+Enter for a new line</span>
            </div>
          </>
        )}
      </section>

      {/* Details */}
      {conversationId && active && showInfo && (
        <aside className="hidden flex-col gap-5 overflow-y-auto border-l border-line bg-white px-[22px] py-6 lg:flex" style={{ flex: "0 0 290px" }}>
          <div className="flex flex-col items-center gap-2.5 border-b border-mist pb-[18px] text-center">
            <Avatar name={other?.name} src={other?.photoUrl} size={76} solid />
            <span className="serif text-[22px]">{other?.name}</span>
            <span className="text-[13px] text-ink-2">
              {other?.role === "teacher" ? "Teacher" : other?.isChild ? "Child account" : other?.role === "parent" ? "Parent" : "Student"}
              {other?.memberSince ? ` · joined ${relativeTime(other.memberSince).toLowerCase()}` : ""}
            </span>
            {other?.role === "teacher" && <Link to={`/teachers/${other._id}`} className="text-[13px] font-semibold">View profile →</Link>}
          </div>
          <div className="flex flex-col gap-2">
            <span className="eyebrow-muted text-xs">About this chat</span>
            {active.listing && (
              <Link to={`/listings/${active.listing._id}`} className="flex flex-col gap-1 rounded-xl border border-line bg-page p-3.5 text-ink hover:border-lavender hover:text-ink">
                <span className="serif text-base font-bold leading-tight">{active.listing.subject} · {active.listing.grade}</span>
                <span className="text-[13px] text-ink-2">Interest {active.interestStatus || "accepted"}</span>
              </Link>
            )}
            <span className="text-[13px] text-ink-2">Chat opened {relativeTime(active.createdAt).toLowerCase()}</span>
          </div>
          <div className="card-mist flex flex-col gap-2.5 rounded-[14px] p-[18px]">
            <span className="serif text-[17px] font-bold">Ready to start?</span>
            <span className="text-[13px] leading-normal text-ink-2">Book a trial class from the teacher's weekly availability, then manage it in Bookings.</span>
            <Link to="/interests" className="btn btn-primary btn-sm">Book from Interests</Link>
            <Link to="/bookings" className="text-center text-[13px] font-semibold">My bookings →</Link>
          </div>
          <div className="mt-auto flex flex-col gap-1">
            <button type="button" onClick={() => setReport(true)} className="rounded-lg border-0 bg-transparent px-2.5 py-2 text-left text-sm text-danger hover:bg-danger-soft">
              Report this user
            </button>
          </div>
        </aside>
      )}
      {other && <ReportModal open={report} onClose={() => setReport(false)} targetType="user" targetId={other._id} targetLabel={other.name} />}
    </div>
  );
};

export default ChatPage;
