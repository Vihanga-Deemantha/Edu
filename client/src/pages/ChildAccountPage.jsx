import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, ChipSelect, Field, Modal, Spinner, StatusBadge, VerifiedBadge } from "../components/ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { bookingsApi, interestsApi, profilesApi } from "../api/endpoints.js";
import { GRADES, MEDIUMS, SUBJECTS, apiError, formatDateTime, formatTime, relativeTime } from "../lib/format.js";

const CHILD_GRADES = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "Grade 13"];

const AddChildModal = ({ open, onClose, onAdded }) => {
  const { registerChild } = useAuth();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e = {};
    if (!name.trim()) e.name = "Enter a first name.";
    if (!consent) e.consent = "Please confirm you are the parent or guardian.";
    if (Object.keys(e).length) return setErrors(e);
    setBusy(true);
    try {
      const child = await registerChild({ name: name.trim(), ...(grade ? { grade } : {}), attestedGuardianship: true });
      toast.success(`${child?.name || name} added`);
      onAdded?.(child);
      setName("");
      setGrade("");
      setConsent(false);
      onClose();
    } catch (err) {
      toast.error(apiError(err, "Couldn't add your child."));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} width={520}>
      <div className="flex flex-col gap-[18px] p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="serif text-[28px] font-bold leading-tight">Add a child</span>
            <span className="text-sm text-ink-2">Only the first name and grade are shown to teachers. Children never log in.</span>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-0 bg-mist text-sm">✕</button>
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <Field label="First name" error={errors.name}>
            <input className={`input ${errors.name ? "err" : ""}`} value={name} placeholder="e.g. Senuri" onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: "" })); }} />
          </Field>
          <Field label="Grade (optional)">
            <select className="select" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Select grade</option>
              {CHILD_GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-normal" style={{ background: consent ? "var(--mist)" : "var(--page)", borderColor: errors.consent ? "#E8B4B0" : "var(--line)" }}>
          <input type="checkbox" className="check mt-0.5" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: "" })); }} />
          <span>I'm this child's parent or legal guardian and I'll supervise their use of EduLink.</span>
        </label>
        {errors.consent && <span className="field-err -mt-2.5">{errors.consent}</span>}
        <div className="flex justify-end gap-2.5">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>{busy && <Spinner dark={false} />} Add child</button>
        </div>
      </div>
    </Modal>
  );
};

const ChildProfileForm = ({ child }) => {
  const { data, loading } = useAsync(() => profilesApi.getStudent(child._id).then((d) => d.profile).catch(() => null), [child._id]);
  const toForm = (p) => ({ gradeOrLevel: p?.gradeOrLevel || "", subjectsInterested: p?.subjectsInterested || [], medium: p?.medium || [] });
  const [form, setForm] = useState(() => toForm(data));
  const [seededFrom, setSeededFrom] = useState(data);
  const [saving, setSaving] = useState(false);
  if (seededFrom !== data) {
    setSeededFrom(data);
    setForm(toForm(data));
  }

  const save = async () => {
    setSaving(true);
    try {
      await profilesApi.upsertStudent({ targetUserId: child._id, gradeOrLevel: form.gradeOrLevel || null, subjectsInterested: form.subjectsInterested, medium: form.medium });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card flex items-center gap-2 p-7 text-sm text-ink-2"><Spinner /> Loading…</div>;

  return (
    <section className="card rise flex max-w-[720px] flex-col gap-5 rounded-[18px] p-7">
      <div className="flex flex-col gap-1">
        <h2 className="serif text-[26px]">{child.name}'s learning profile</h2>
        <span className="text-sm text-ink-2">Teachers see the first name, grade and learning needs. Nothing else. We use this to recommend teachers.</span>
      </div>
      <Field label="Level">
        <select className="select" value={form.gradeOrLevel} onChange={(e) => setForm((f) => ({ ...f, gradeOrLevel: e.target.value }))}>
          <option value="">Choose a level</option>
          {GRADES.map((g) => <option key={g}>{g}</option>)}
          {form.gradeOrLevel && !GRADES.includes(form.gradeOrLevel) && <option>{form.gradeOrLevel}</option>}
        </select>
      </Field>
      <div className="flex flex-col gap-2.5">
        <span className="field-label">Subjects</span>
        <ChipSelect options={SUBJECTS} value={form.subjectsInterested} onChange={(subjectsInterested) => setForm((f) => ({ ...f, subjectsInterested }))} />
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="field-label">Medium</span>
        <ChipSelect options={MEDIUMS} value={form.medium} onChange={(medium) => setForm((f) => ({ ...f, medium }))} />
      </div>
      <div className="flex justify-end border-t border-mist pt-4">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving && <Spinner dark={false} />} Save profile</button>
      </div>
    </section>
  );
};

const SAFETY = [
  ["Only fully verified teachers", "Teachers must pass ID and police clearance checks before they can accept a request for a child."],
  ["Messages come to you", "Teachers chat with your account. Your child never receives messages directly."],
  ["Contact details stay private", "Your email and phone are shared only after you accept a teacher — never your child's."],
  ["Every booking and payment is yours", "Only you can book, cancel or pay for your child's classes."],
];

const ChildAccountPage = () => {
  const { user } = useAuth();
  const children = useMemo(() => user.linkedChildIds || [], [user]);
  const [selId, setSelId] = useState(children[0]?._id || null);
  const [tab, setTab] = useState("overview");
  const [adding, setAdding] = useState(false);
  const sel = children.find((c) => c._id === selId) || children[0];

  const { data: sent } = useAsync(() => interestsApi.sent({ limit: 50 }), []);
  const { data: bookingData } = useAsync(() => bookingsApi.mine({ limit: 50 }), []);

  const byChild = useMemo(() => {
    const map = {};
    children.forEach((c) => {
      const id = String(c._id);
      const interests = (sent?.interests || []).filter((i) => String(i.fromUserId) === id || String(i.toUserId) === id);
      const bookings = (bookingData?.bookings || []).filter((b) => String(b.studentId) === id);
      const teachers = [];
      interests
        .filter((i) => ["accepted", "completed"].includes(i.status))
        .forEach((i) => {
          const t = i.toUser?.role === "teacher" ? i.toUser : i.fromUser?.role === "teacher" ? i.fromUser : null;
          if (t && !teachers.some((x) => String(x._id) === String(t._id))) teachers.push({ ...t, interest: i });
        });
      const upcoming = bookings
        .filter((b) => b.status === "confirmed" && new Date(b.startTime) > new Date())
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
      const unpaid = upcoming.filter((b) => b.payment?.status !== "paid");
      map[id] = { interests, bookings, teachers, upcoming, unpaid, pending: interests.filter((i) => i.status === "pending") };
    });
    return map;
  }, [children, sent, bookingData]);

  if (children.length === 0) {
    return (
      <div className="shell-narrow flex flex-col gap-7 pb-24 pt-8">
        <div className="flex max-w-[640px] flex-col gap-2">
          <span className="eyebrow">Parent</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>Your children</h1>
        </div>
        <div className="flex flex-wrap items-center gap-10 rounded-3xl bg-mist p-12">
          <div className="flex flex-col gap-4" style={{ flex: "1 1 360px" }}>
            <h2 className="serif text-[38px] leading-tight">Add your first child</h2>
            <p className="serif text-lg leading-normal text-ink-2">Create a profile for each child. You'll send interest requests, chat with teachers and pay for classes on their behalf.</p>
            <button type="button" className="btn btn-primary btn-lg mt-1.5 self-start" onClick={() => setAdding(true)}>+ Add a child</button>
          </div>
          <div className="flex flex-col gap-2.5" style={{ flex: "1 1 280px" }}>
            {["Add your child's name and grade", "Find a fully verified teacher", "Chat, book and pay on their behalf"].map((t, i) => (
              <div key={t} className="flex items-center gap-3.5 rounded-[14px] bg-white px-[18px] py-4">
                <span className="serif text-[28px] italic leading-none text-lavender">0{i + 1}</span>
                <span className="text-[15px] font-semibold">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <AddChildModal open={adding} onClose={() => setAdding(false)} onAdded={(c) => c && setSelId(c._id)} />
      </div>
    );
  }

  const cur = byChild[String(sel._id)] || { interests: [], bookings: [], teachers: [], upcoming: [], unpaid: [], pending: [] };
  const activity = [
    ...cur.interests.map((i) => ({
      when: i.respondedAt || i.createdAt,
      text:
        i.status === "pending"
          ? `Interest sent to ${i.toUser?.name || "a teacher"} for ${i.listing?.subject || "a class"}.`
          : i.status === "accepted"
            ? `${i.toUser?.name || "The teacher"} accepted your request for ${i.listing?.subject || "a class"}.`
            : i.status === "declined"
              ? `${i.toUser?.name || "The teacher"} declined the request for ${i.listing?.subject || "a class"}.`
              : `Classes for ${i.listing?.subject || "a subject"} marked completed.`,
      link: i.status === "accepted" && i.conversationId ? { to: `/chat/${i.conversationId}`, label: "Chat" } : { to: "/interests?tab=sent", label: "View" },
      icon: i.status === "accepted" ? "✓" : i.status === "declined" ? "·" : "→",
    })),
    ...cur.bookings.map((b) => ({
      when: b.createdAt,
      text: `${b.status === "cancelled" ? "Cancelled" : "Booked"} ${b.listing?.subject || "a class"} with ${b.teacher?.name || "a teacher"} for ${formatDateTime(b.startTime)}.`,
      link: { to: "/bookings", label: "View" },
      icon: "◷",
    })),
  ]
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 8);

  return (
    <div className="shell-narrow flex flex-col gap-[26px] pb-24 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-[640px] flex-col gap-2">
          <span className="eyebrow">Parent</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>Your children</h1>
          <p className="serif text-[17px] leading-normal text-ink-2">Children don't have their own login. You send requests, read every message and manage bookings on their behalf.</p>
        </div>
        <button type="button" className="btn btn-primary rounded-[10px] px-[22px] py-[13px]" onClick={() => setAdding(true)}>+ Add a child</button>
      </div>

      <div className="flex flex-wrap gap-3">
        {children.map((c) => {
          const on = c._id === sel._id;
          const d = byChild[String(c._id)];
          const alert = d?.unpaid.length || 0; // deposits due
          return (
            <button
              key={c._id}
              type="button"
              onClick={() => setSelId(c._id)}
              aria-pressed={on}
              className="flex items-center gap-3.5 rounded-2xl border-[1.5px] px-[18px] py-4 text-left transition-colors"
              style={{ flex: "0 1 300px", background: on ? "var(--ink)" : "#fff", color: on ? "#fff" : "var(--ink)", borderColor: on ? "var(--ink)" : "var(--line)" }}
            >
              <Avatar name={c.name} size={52} solid={on} />
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="serif text-xl font-bold">{c.name}</span>
                <span className="truncate text-[13px]" style={{ color: on ? "var(--lavender)" : "var(--ink-2)" }}>
                  {[c.grade, d?.teachers.length ? `${d.teachers.length} teacher${d.teachers.length > 1 ? "s" : ""}` : "No teachers yet"].filter(Boolean).join(" · ")}
                </span>
              </span>
              {alert > 0 && <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{alert}</span>}
            </button>
          );
        })}
      </div>

      <div className="tabs no-scrollbar" role="tablist">
        {[["overview", "Overview"], ["profile", "Learning profile"], ["safety", "Safety"]].map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="rise flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-col gap-6" style={{ flex: "999 1 520px" }}>
            {cur.unpaid.length > 0 && (
              <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border px-5 py-4" style={{ background: "var(--danger-soft)", borderColor: "#E8B4B0" }}>
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-danger font-bold text-white">!</span>
                <span className="text-sm leading-normal" style={{ flex: "1 1 260px" }}>
                  <b>Deposit due</b> for {sel.name}'s {cur.unpaid[0].listing?.subject || "class"} on {formatDateTime(cur.unpaid[0].startTime)}.
                </span>
                <Link to="/bookings" className="btn btn-primary btn-sm">Pay deposit</Link>
              </div>
            )}

            <section className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                <h2 className="serif text-[28px]">{sel.name}'s teachers</h2>
                <Link to="/browse" className="text-sm font-semibold">Find a teacher for {sel.name} →</Link>
              </div>
              {cur.teachers.length ? (
                <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
                  {cur.teachers.map((t) => {
                    const next = cur.upcoming.find((b) => String(b.teacherId) === String(t._id));
                    return (
                      <div key={t._id} className="card flex flex-col gap-3 p-[18px]">
                        <div className="flex items-center gap-3">
                          <Avatar name={t.name} src={t.photoUrl} size={44} />
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <Link to={`/teachers/${t._id}`} className="serif text-[17px] font-bold text-ink hover:text-primary">{t.name}</Link>
                            <VerifiedBadge tier={t.verificationStatus} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold">{t.interest.listing ? `${t.interest.listing.subject} · ${t.interest.listing.grade}` : ""}</span>
                        <span className="text-[13px] text-ink-2">{next ? `Next: ${formatDateTime(next.startTime)}` : "No class booked yet"}</span>
                        <div className="flex gap-2 border-t border-mist pt-2.5">
                          {t.interest.conversationId && <Link to={`/chat/${t.interest.conversationId}`} className="btn btn-outline btn-sm flex-1">Messages</Link>}
                          <Link to="/bookings" className="btn btn-soft btn-sm flex-1">Bookings</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-white p-8 text-center" style={{ borderColor: "var(--lavender)" }}>
                  <span className="serif text-[22px]">No teachers yet</span>
                  <span className="max-w-[380px] text-sm text-ink-2">
                    {cur.pending.length ? `${cur.pending.length} request${cur.pending.length > 1 ? "s are" : " is"} waiting for a reply.` : `Browse fully verified teachers and send an interest request for ${sel.name}.`}
                  </span>
                  <Link to="/browse" className="btn btn-primary btn-sm mt-1.5">Browse teachers</Link>
                </div>
              )}
            </section>

            <section className="flex flex-col gap-3.5">
              <h2 className="serif text-[28px]">Recent activity</h2>
              <div className="card overflow-hidden">
                {activity.length === 0 && <div className="px-6 py-8 text-center text-sm text-ink-2">Nothing yet. Requests, bookings and replies for {sel.name} will show up here.</div>}
                {activity.map((a, i) => (
                  <div key={i} className="divider-row flex items-start gap-3.5 px-[18px] py-3.5">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-mist text-sm font-bold text-primary">{a.icon}</span>
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="text-sm leading-snug">{a.text}</span>
                      <span className="text-xs text-ink-2">{relativeTime(a.when)}</span>
                    </div>
                    <Link to={a.link.to} className="whitespace-nowrap text-[13px] font-semibold">{a.link.label}</Link>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="flex flex-col gap-3.5" style={{ flex: "1 1 280px", maxWidth: 360 }}>
            <div className="card-dark flex flex-col gap-3.5 rounded-[18px] p-[22px]">
              <span className="serif text-[22px]">Coming up</span>
              {cur.upcoming.slice(0, 4).map((b) => {
                const d = new Date(b.startTime);
                return (
                  <div key={b._id} className="flex items-center gap-3 rounded-xl bg-white/[.07] p-3">
                    <div className="flex w-10 flex-none flex-col items-center">
                      <span className="text-[11px] font-bold text-lavender">{d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase()}</span>
                      <span className="serif text-[22px] leading-none">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{b.listing?.subject || "Class"}</div>
                      <div className="text-xs text-lavender">{formatTime(b.startTime)} – {formatTime(b.endTime)} · {b.teacher?.name}</div>
                    </div>
                  </div>
                );
              })}
              {cur.upcoming.length === 0 && <span className="text-sm text-lavender">No classes booked.</span>}
            </div>
            <div className="card-mist flex flex-col gap-2.5 rounded-[18px] p-5">
              <span className="serif text-[17px] font-bold">How child safety works</span>
              {SAFETY.slice(0, 3).map(([t]) => (
                <span key={t} className="flex gap-2.5 text-[13px] leading-normal"><b className="text-primary">✓</b>{t}</span>
              ))}
            </div>
          </aside>
        </div>
      )}

      {tab === "profile" && <ChildProfileForm key={sel._id} child={sel} />}

      {tab === "safety" && (
        <section className="card rise flex max-w-[720px] flex-col gap-1.5 rounded-[18px] p-7">
          <div className="mb-3 flex flex-col gap-1">
            <h2 className="serif text-[26px]">Safety for {sel.name}</h2>
            <span className="text-sm text-ink-2">These protections apply to every teacher who works with {sel.name}. They're built in and can't be turned off.</span>
          </div>
          {SAFETY.map(([label, sub]) => (
            <div key={label} className="flex items-center justify-between gap-5 border-t border-mist py-4">
              <div className="flex flex-col gap-[3px]">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">{label}<StatusBadge status="active" label="Always on" className="text-[11px]" /></span>
                <span className="text-[13px] leading-normal text-ink-2">{sub}</span>
              </div>
            </div>
          ))}
          <span className="mt-3 text-[13px] text-ink-2">
            Something doesn't feel right? Use “Report” on any profile, listing or chat — our team reviews reports within 24 hours.
          </span>
        </section>
      )}

      <AddChildModal open={adding} onClose={() => setAdding(false)} onAdded={(c) => c && setSelId(c._id)} />
    </div>
  );
};

export default ChildAccountPage;
