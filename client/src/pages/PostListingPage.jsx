import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, ChipSelect, EmptyState, ErrorState, Field, Modal, PageLoader, Spinner, StatusBadge, VerifiedBadge } from "../components/ui/index.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { listingsApi, profilesApi } from "../api/endpoints.js";
import { CURRICULA, GRADES, MEDIUMS, SUBJECTS, apiError, formatNumber, mediumLabel } from "../lib/format.js";

const DESC_MAX = 2000;
const DESC_MIN = 10;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ROWS = [
  ["Morning", "7 am – 12 pm", "mornings"],
  ["Afternoon", "12 – 5 pm", "afternoons"],
  ["Evening", "5 – 9 pm", "evenings"],
];
const LANGS = [
  ["description", "English"],
  ["description_si", "සිංහල"],
  ["description_ta", "தமிழ்"],
];

// Schedule is stored as free-text strings (spec §5.1); the grid writes one
// "Mon mornings"-style entry per ticked cell and reads the same format back.
const slotLabel = (day, row) => `${day} ${ROWS[row][2]}`;
const gridFromSchedule = (schedule = []) => {
  const slots = {};
  const extra = [];
  schedule.forEach((s) => {
    const m = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (mornings|afternoons|evenings)$/.exec(s);
    if (m) slots[`${m[1]}-${ROWS.findIndex((r) => r[2] === m[2])}`] = true;
    else extra.push(s);
  });
  return { slots, extra };
};

const EMPTY = {
  subject: "", grade: "", medium: "", curriculum: "", price: "", unit: "hour",
  slots: {}, extraSchedule: [], description: "", description_si: "", description_ta: "", location: null,
};

const Step = ({ n, title, aside, children }) => (
  <section className="card flex flex-col gap-[22px] rounded-[18px] p-7">
    <div className="flex flex-wrap items-baseline justify-between gap-3.5">
      <div className="flex items-baseline gap-3.5">
        <span className="serif text-[28px] italic leading-none text-lavender">0{n}</span>
        <h2 className="serif text-[26px]">{title}</h2>
      </div>
      {aside}
    </div>
    {children}
  </section>
);

const PostListingPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTeacher = user.role === "teacher";
  const children = user.role === "parent" ? user.linkedChildIds || [] : [];
  const [childId, setChildId] = useState(children[0]?._id || "");

  const { data: existing, loading, error } = useAsync(() => listingsApi.get(id), [id], { enabled: isEdit });
  const { data: profileData, loading: profileLoading } = useAsync(() => profilesApi.getTeacher(user._id).catch(() => null), [], { enabled: isTeacher });
  const profile = profileData?.profile;

  const initial = useMemo(() => {
    const l = existing?.listing;
    if (!l) return { ...EMPTY, location: profile?.location || null };
    const { slots, extra } = gridFromSchedule(l.schedule);
    return {
      subject: l.subject, grade: l.grade, medium: l.medium, curriculum: l.curriculum || "",
      price: l.price?.amount !== undefined ? String(l.price.amount) : "", unit: l.price?.unit || "hour",
      slots, extraSchedule: extra,
      description: l.description || "", description_si: l.description_si || "", description_ta: l.description_ta || "",
      location: l.location || null,
    };
  }, [existing, profile]);

  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [lang, setLang] = useState("description");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState(null); // "done" | "close"
  const [savedId, setSavedId] = useState(null);

  // Re-seed the form when the listing/profile it's based on finishes loading.
  const [seededFrom, setSeededFrom] = useState(initial);
  if (seededFrom !== initial) {
    setSeededFrom(initial);
    setF(initial);
    setDirty(false);
  }

  const { data: suggestion } = useAsync(
    () => listingsApi.priceSuggestion({ subject: f.subject || undefined, grade: f.grade || undefined, medium: f.medium || undefined }),
    [f.subject, f.grade, f.medium],
    { enabled: isTeacher && Boolean(f.subject) }
  );

  const patch = (p) => {
    setF((x) => ({ ...x, ...p }));
    setDirty(true);
    setErrors((e) => {
      const next = { ...e };
      Object.keys(p).forEach((k) => delete next[k.startsWith("description") ? "description" : k]);
      return next;
    });
  };

  const validate = () => {
    const e = {};
    if (!f.subject) e.subject = "Choose a subject.";
    if (!f.grade) e.grade = "Choose a level.";
    if (!f.medium) e.medium = "Choose a medium.";
    if (isTeacher && !f.price) e.price = "Enter a fee.";
    if (f.price && Number(f.price) < 0) e.price = "Enter a valid amount.";
    const d = f.description.trim().length;
    if (d < DESC_MIN) e.description = `Write at least ${DESC_MIN} characters in English.`;
    ["description_si", "description_ta"].forEach((k) => {
      const len = f[k].trim().length;
      if (len > 0 && len < DESC_MIN) e.description = `Translations also need at least ${DESC_MIN} characters, or leave them empty.`;
    });
    if (user.role === "parent" && !isEdit && !childId) e.child = "Choose which child this ad is for.";
    return e;
  };

  const schedule = [
    ...DAYS.flatMap((d) => ROWS.map((_, r) => (f.slots[`${d}-${r}`] ? slotLabel(d, r) : null))).filter(Boolean),
    ...f.extraSchedule,
  ];

  const payload = () => ({
    subject: f.subject,
    grade: f.grade,
    medium: f.medium,
    curriculum: f.curriculum || null,
    price: f.price ? { amount: Number(f.price), unit: f.unit } : null,
    schedule,
    description: f.description.trim(),
    description_si: f.description_si.trim() || null,
    description_ta: f.description_ta.trim() || null,
    ...(f.location ? { location: f.location } : {}),
  });

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await listingsApi.update(id, payload());
        setSavedId(id);
      } else {
        const { listing } = await listingsApi.create({
          type: isTeacher ? "teacher_ad" : "student_ad",
          ...payload(),
          ...(user.role === "parent" ? { targetUserId: childId } : {}),
        });
        setSavedId(listing._id);
      }
      setDirty(false);
      setModal("done");
    } catch (err) {
      toast.error(apiError(err, "Couldn't save your ad."));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    try {
      if (status === "closed") await listingsApi.close(id);
      else await listingsApi.update(id, { status: "active" });
      toast.success(status === "closed" ? "Listing closed" : "Listing reopened");
      setModal(null);
      navigate("/listings/mine");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  if (isEdit && loading) return <PageLoader />;
  if (isEdit && (error || !existing?.listing)) return <ErrorState title="Listing not found">It may have been removed, or it isn't yours to edit.</ErrorState>;
  if (user.role === "parent" && !isEdit && children.length === 0) {
    return (
      <div className="shell-narrow py-12">
        <div className="card">
          <EmptyState icon="users" title="Add a child first" action={<Link to="/children" className="btn btn-primary">Add a child</Link>}>
            Wanted ads on a parent account are posted for a specific child.
          </EmptyState>
        </div>
      </div>
    );
  }

  const listingStatus = existing?.listing?.status;
  const errorCount = Object.keys(errors).length;
  const noun = isTeacher ? "class ad" : "wanted ad";
  const checks = [
    ["Subject & level", Boolean(f.subject && f.grade)],
    ["Medium", Boolean(f.medium)],
    ["Schedule", schedule.length > 0],
    [isTeacher ? "Fee" : "Budget (optional)", Boolean(f.price) || !isTeacher],
    ["Description", f.description.trim().length >= DESC_MIN],
    ["Location", Boolean(f.location)],
  ];
  const tier = profile?.verificationStatus;

  return (
    <div className="shell-narrow flex flex-col gap-7 pb-36 pt-8">
      <nav className="flex flex-wrap gap-2 text-sm text-ink-2" aria-label="Breadcrumb">
        <Link to="/listings/mine">My listings</Link><span>/</span><span className="text-ink">{isEdit ? "Edit ad" : "New ad"}</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="eyebrow">{isEdit ? `Edit ${noun}` : `New ${noun}`}</span>
            {isEdit && <StatusBadge status={listingStatus} />}
          </div>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>
            {isEdit ? `Edit your ${noun}` : isTeacher ? "Post a class ad" : "Post a wanted ad"}
          </h1>
          {!isTeacher && !isEdit && (
            <p className="text-[15px] text-ink-2">Describe what you're looking for. Verified teachers who match will reach out.</p>
          )}
        </div>
        {isEdit && (
          <div className="flex flex-wrap gap-2.5">
            <Link to={`/listings/${id}`} className="btn btn-outline btn-sm">View live ad ↗</Link>
            {listingStatus === "closed" && <button type="button" className="btn btn-soft btn-sm" onClick={() => setStatus("active")}>Reopen ad</button>}
          </div>
        )}
      </div>

      {listingStatus === "flagged" && (
        <div className="rounded-[14px] border px-5 py-4 text-sm leading-relaxed" style={{ background: "var(--danger-soft)", borderColor: "#E8B4B0" }}>
          <b className="text-danger">This listing was flagged for review.</b> It's hidden from search until an admin restores it. Editing it doesn't change that.
        </div>
      )}
      {isTeacher && tier && tier !== "fully_verified" && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-[14px] border bg-mist px-5 py-4" style={{ borderColor: "var(--lavender)" }}>
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-[1.5px] border-primary font-bold text-primary">i</span>
          <span className="text-sm leading-normal" style={{ flex: "1 1 320px" }}>
            {tier === "id_verified" ? (
              <>You're <b>ID verified</b>. Your ad will be public, but parents can only send requests for children once you're <b>fully verified</b>.</>
            ) : (
              <>You're <b>not verified</b> yet. Get verified so students can trust your ad and parents can reach you.</>
            )}
          </span>
          <Link to="/verification" className="whitespace-nowrap text-sm font-semibold">{tier === "id_verified" ? "Add police clearance →" : "Get verified →"}</Link>
        </div>
      )}
      {isTeacher && !profileLoading && !profile && (
        <div className="rounded-[14px] bg-mist px-5 py-4 text-sm">
          Tip: <Link to="/profile/edit" className="font-semibold">build your teacher profile</Link> first — students check it before sending interest.
        </div>
      )}

      <div className="flex flex-wrap items-start gap-9">
        <div className="flex min-w-0 flex-col gap-[22px]" style={{ flex: "999 1 560px" }}>
          {user.role === "parent" && !isEdit && (
            <section className="card flex flex-col gap-3 rounded-[18px] p-7">
              <span className="field-label">Who is this ad for?</span>
              <div className="flex flex-wrap gap-2">
                {children.map((c) => (
                  <button key={c._id} type="button" aria-pressed={childId === c._id} className={`chip ${childId === c._id ? "on" : ""}`} onClick={() => { setChildId(c._id); setErrors((e) => ({ ...e, child: undefined })); }}>
                    {c.name}{c.grade ? ` · ${c.grade}` : ""}
                  </button>
                ))}
              </div>
              {errors.child && <span className="field-err">{errors.child}</span>}
            </section>
          )}

          <Step n={1} title={isTeacher ? "What you teach" : "What you need"}>
            <div className="flex flex-col gap-2.5">
              <span className="field-label">Subject</span>
              <ChipSelect single options={SUBJECTS} value={f.subject} onChange={(subject) => patch({ subject })} />
              {errors.subject && <span className="field-err">{errors.subject}</span>}
            </div>
            <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="flex flex-col gap-2.5">
                <span className="field-label">Level</span>
                <ChipSelect single options={GRADES} value={f.grade} onChange={(grade) => patch({ grade })} />
                {errors.grade && <span className="field-err">{errors.grade}</span>}
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="field-label">Medium</span>
                <ChipSelect single options={MEDIUMS} value={f.medium} onChange={(medium) => patch({ medium })} />
                {errors.medium && <span className="field-err">{errors.medium}</span>}
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="field-label">Curriculum (optional)</span>
                <ChipSelect single options={CURRICULA} value={f.curriculum} onChange={(curriculum) => patch({ curriculum })} />
              </div>
            </div>
          </Step>

          <Step n={2} title="Where">
            <LocationPicker
              value={f.location}
              onChange={(location) => patch({ location })}
              hint={isTeacher ? "Defaults to your profile location. Only the area is public; the exact address is shared after you accept." : "Helps nearby teachers find you. Only the approximate area is shown."}
            />
          </Step>

          <Step n={3} title="When" aside={isTeacher && <Link to="/availability" className="text-[13px] font-semibold">Set bookable availability →</Link>}>
            <span className="-mt-1.5 text-sm text-ink-2">
              {isTeacher ? "Tap the times this class usually runs. Students book exact slots later, from your availability." : "Tap the times that suit you best."}
            </span>
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] gap-1.5" style={{ gridTemplateColumns: "90px repeat(7, minmax(56px, 1fr))" }}>
                <span />
                {DAYS.map((d) => <span key={d} className="text-center text-[13px] font-bold text-ink-2">{d}</span>)}
                {ROWS.map(([label, sub], r) => (
                  <div key={label} className="contents">
                    <span className="flex flex-col justify-center text-[13px] text-ink-2"><span className="font-semibold text-ink">{label}</span><span className="text-[11px]">{sub}</span></span>
                    {DAYS.map((d) => {
                      const k = `${d}-${r}`;
                      const on = Boolean(f.slots[k]);
                      return (
                        <button
                          key={k}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${d} ${label}`}
                          onClick={() => {
                            const slots = { ...f.slots };
                            if (on) delete slots[k];
                            else slots[k] = true;
                            patch({ slots });
                          }}
                          className="flex h-[42px] items-center justify-center rounded-lg border-[1.5px] text-[13px] font-bold text-white transition-colors hover:border-primary"
                          style={{ background: on ? "var(--primary)" : "var(--line-soft)", borderColor: on ? "var(--primary)" : "var(--line-soft)" }}
                        >
                          {on ? "✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            {f.extraSchedule.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-2">Also listed:</span>
                {f.extraSchedule.map((s) => (
                  <span key={s} className="tag gap-1.5">
                    {s}
                    <button type="button" aria-label={`Remove ${s}`} className="border-0 bg-transparent p-0 text-primary" onClick={() => patch({ extraSchedule: f.extraSchedule.filter((x) => x !== s) })}>✕</button>
                  </span>
                ))}
              </div>
            )}
          </Step>

          <Step n={4} title={isTeacher ? "Price" : "Budget"}>
            <div className="flex flex-wrap items-start gap-3.5">
              <Field label={isTeacher ? "Fee" : "Budget (optional)"} error={errors.price} className="flex-[1_1_220px]">
                <div className={`input-group ${errors.price ? "err" : ""}`} style={{ height: 50 }}>
                  <span className="addon text-sm font-bold">LKR</span>
                  <input
                    inputMode="numeric"
                    value={f.price ? formatNumber(f.price) : ""}
                    onChange={(e) => patch({ price: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                    placeholder="2,500"
                    className="serif text-xl"
                    style={{ height: 47 }}
                  />
                </div>
              </Field>
              <div className="flex flex-col gap-[7px]" style={{ flex: "1 1 220px" }}>
                <span className="field-label">Per</span>
                <div className="seg h-[50px] w-full rounded-[10px] p-1">
                  {[["hour", "Hour"], ["month", "Month"]].map(([k, label]) => (
                    <button key={k} type="button" className={`seg-item flex-1 text-sm ${f.unit === k ? "on" : ""}`} onClick={() => patch({ unit: k })}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            {isTeacher && suggestion?.suggestion && (
              <span className="-mt-1.5 text-[13px] text-ink-2">
                Similar {f.subject}{f.grade ? ` ${f.grade}` : ""} classes on EduLink charge LKR {formatNumber(suggestion.suggestion.p25)}–{formatNumber(suggestion.suggestion.p75)} (median {formatNumber(suggestion.suggestion.median)}, from {suggestion.sampleSize} ads).
              </span>
            )}
          </Step>

          <Step
            n={5}
            title="Description"
            aside={
              <div className="seg" role="tablist">
                {LANGS.map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={lang === k} className={`seg-item flex items-center gap-1.5 ${lang === k ? "on" : ""}`} onClick={() => setLang(k)}>
                    {label}
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: f[k].trim() ? "var(--primary)" : "var(--lavender)" }} />
                  </button>
                ))}
              </div>
            }
          >
            <textarea
              rows={7}
              className={`textarea serif text-[17px] ${errors.description ? "err" : ""}`}
              value={f[lang]}
              onChange={(e) => patch({ [lang]: e.target.value.slice(0, DESC_MAX) })}
              placeholder={
                lang === "description"
                  ? isTeacher
                    ? "What will students learn? How are classes run? Who is this class best for?"
                    : "What do you need help with? Your goals, current level, and anything a teacher should know."
                  : "Optional translation. If empty, readers see the English text with a note."
              }
            />
            <div className="flex flex-wrap justify-between gap-3 text-[13px]">
              <span className={errors.description ? "text-danger" : "text-ink-2"}>
                {errors.description ||
                  (lang === "description"
                    ? f.description.trim().length < DESC_MIN
                      ? `At least ${DESC_MIN} characters.`
                      : "Looks good."
                    : "Translations help families who prefer Sinhala or Tamil.")}
              </span>
              <span className="text-ink-2">{f[lang].length} / {DESC_MAX}</span>
            </div>
          </Step>

          {isEdit && listingStatus !== "closed" && (
            <section className="flex flex-wrap items-center justify-between gap-3.5 rounded-[18px] border bg-white px-7 py-[22px]" style={{ borderColor: "#E8B4B0" }}>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[15px] font-semibold text-danger">Close this listing</span>
                <span className="text-[13px] text-ink-2">Removes it from search. Existing students and chats are not affected. You can reopen it later.</span>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal("close")}>Close listing</button>
            </section>
          )}
        </div>

        <aside className="sticky top-[104px] flex flex-col gap-3.5" style={{ flex: "1 1 320px", maxWidth: 400 }}>
          <span className="eyebrow-muted">Live preview · how {isTeacher ? "students" : "teachers"} see it</span>
          <div className="card flex flex-col overflow-hidden" style={{ boxShadow: "0 24px 50px -30px rgba(22,27,63,.35)" }}>
            <div className="h-1 bg-blue" />
            <div className="flex flex-col gap-3 p-[22px]">
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={profile?.photoUrl} size={48} />
                <div className="flex flex-col gap-[3px]">
                  <span className="serif text-[17px] font-bold">{user.role === "parent" ? children.find((c) => c._id === childId)?.name || user.name : user.name}</span>
                  {isTeacher ? <VerifiedBadge tier={tier} /> : <span className="eyebrow text-[11px]">Wanted</span>}
                </div>
              </div>
              <span className="serif text-xl font-bold leading-tight" style={{ color: f.subject ? "var(--ink)" : "var(--lavender)" }}>
                {f.subject ? `${f.subject}${f.grade ? ` — ${f.grade}` : ""}` : "Subject — level"}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {f.medium && <span className="tag">{mediumLabel(f.medium)} medium</span>}
                {f.curriculum && <span className="tag">{CURRICULA.find((c) => c.value === f.curriculum)?.label}</span>}
              </div>
              <span className="text-[13px] text-ink-2">{schedule.length ? schedule.join(" · ") : "Schedule not set"}</span>
              <div className="flex items-center justify-between border-t border-mist pt-3">
                <span className="serif text-xl">
                  {f.price ? `LKR ${formatNumber(f.price)}` : "LKR —"}
                  <span className="font-sans text-[13px] text-ink-2"> / {f.unit === "month" ? "month" : "hr"}</span>
                </span>
                <span className="text-sm font-semibold text-primary">View →</span>
              </div>
            </div>
          </div>
          <div className="card-mist flex flex-col gap-2.5 rounded-2xl px-5 py-[18px]">
            <div className="flex items-baseline justify-between">
              <span className="serif text-[17px] font-bold">Ready to publish</span>
              <span className="text-[13px] font-bold text-primary">{checks.filter((c) => c[1]).length} / {checks.length}</span>
            </div>
            {checks.map(([label, ok]) => (
              <span key={label} className="flex items-center gap-2 text-[13px]" style={{ color: ok ? "var(--ink)" : "var(--ink-2)" }}>
                <span className="flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] text-[9px] text-white" style={{ borderColor: ok ? "var(--primary)" : "var(--lavender)", background: ok ? "var(--primary)" : "#fff" }}>
                  {ok ? "✓" : ""}
                </span>
                {label}
              </span>
            ))}
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-[45] border-t border-line" style={{ background: "rgba(251,250,253,.96)", backdropFilter: "blur(10px)" }}>
        <div className="shell-narrow flex flex-wrap items-center gap-3.5 py-3.5">
          <span className="text-sm" style={{ flex: "1 1 240px", color: errorCount ? "var(--danger)" : "var(--ink-2)" }}>
            {errorCount
              ? `${errorCount} field${errorCount > 1 ? "s" : ""} need attention before ${isEdit ? "saving" : "publishing"}.`
              : isEdit
                ? dirty ? "Unsaved changes" : "All changes saved"
                : "Nothing is public until you publish."}
          </span>
          {isEdit && dirty && (
            <button type="button" className="btn btn-soft" onClick={() => { setF(initial); setDirty(false); setErrors({}); }}>Discard changes</button>
          )}
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving || (isEdit && !dirty)}>
            {saving && <Spinner dark={false} />}
            {saving ? (isEdit ? "Saving…" : "Publishing…") : isEdit ? "Save changes" : "Publish ad"}
          </button>
        </div>
      </div>

      <Modal open={modal === "done"} onClose={() => setModal(null)} width={460}>
        <div className="flex flex-col items-center gap-3.5 p-[30px] text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-[28px] text-white">✓</div>
          <span className="serif text-[30px]">{isEdit ? "Changes saved" : "Your ad is live"}</span>
          <span className="text-[15px] leading-normal text-ink-2">
            {isTeacher ? "Your ad is in search. We'll notify you when students send interest requests." : "Teachers who match can now find your ad. We'll notify you when one reaches out."}
          </span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <Link to={`/listings/${savedId}`} className="btn btn-primary">View ad</Link>
            <Link to="/listings/mine" className="btn btn-soft">My listings</Link>
          </div>
        </div>
      </Modal>
      <Modal open={modal === "close"} onClose={() => setModal(null)} width={460}>
        <div className="flex flex-col items-center gap-3.5 p-[30px] text-center">
          <span className="serif text-[28px]">Close this listing?</span>
          <span className="text-[15px] leading-normal text-ink-2">It will disappear from search. You can reopen it from My listings at any time.</span>
          <div className="mt-1.5 flex gap-2.5">
            <button type="button" className="btn btn-soft" onClick={() => setModal(null)}>Cancel</button>
            <button type="button" className="btn bg-danger text-white hover:opacity-90" onClick={() => setStatus("closed")}>Close listing</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PostListingPage;
