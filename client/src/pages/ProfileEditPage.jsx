import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, ChipSelect, EmptyState, Field, PageLoader, Spinner, StatusBadge } from "../components/ui/index.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { profilesApi, verificationApi } from "../api/endpoints.js";
import { CLASS_TYPES, CURRICULA, GRADES, MEDIUMS, SUBJECTS, apiError, formatDate } from "../lib/format.js";

const BIO_MAX = 1000;
const BIO_MIN = 80;
const LANGS = [
  ["bio", "English"],
  ["bio_si", "සිංහල"],
  ["bio_ta", "தமிழ்"],
];

const EMPTY_TEACHER = {
  subjects: [], grades: [], medium: [], curriculum: [], classType: [],
  bio: "", bio_si: "", bio_ta: "", qualifications: [], experienceYears: 0,
  photoUrl: "", introVideoUrl: "", location: null,
};
const EMPTY_STUDENT = { gradeOrLevel: "", subjectsInterested: [], medium: [], location: null };

const pickTeacher = (p) => ({
  ...EMPTY_TEACHER,
  ...Object.fromEntries(Object.keys(EMPTY_TEACHER).map((k) => [k, p?.[k] ?? EMPTY_TEACHER[k]])),
});
const pickStudent = (p) => ({
  ...EMPTY_STUDENT,
  ...Object.fromEntries(Object.keys(EMPTY_STUDENT).map((k) => [k, p?.[k] ?? EMPTY_STUDENT[k]])),
});

const Section = ({ id, title, sub, children, dark }) => (
  <section id={id} className={`flex flex-col gap-[22px] rounded-[18px] p-7 ${dark ? "bg-ink text-white" : "card"}`} style={{ scrollMarginTop: 110 }}>
    {title && (
      <div className="flex flex-col gap-1">
        <h2 className="serif text-[28px]">{title}</h2>
        {sub && <span className={`text-sm ${dark ? "text-on-dark" : "text-ink-2"}`}>{sub}</span>}
      </div>
    )}
    {children}
  </section>
);

const Label = ({ children }) => <span className="field-label">{children}</span>;

// ─── Teacher form ────────────────────────────────────────────────────────────
const TeacherForm = ({ form, set, errors, bioLang, setBioLang, verification }) => (
  <>
    <Section id="basic" title="Basic information" sub="Your name and photo appear on every listing.">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar name={form._name} src={form.photoUrl} size={96} />
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <Field label="Profile photo URL" hint="A clear, friendly headshot. Profiles with a photo get more requests.">
            <input className="input" type="url" placeholder="https://…" value={form.photoUrl || ""} onChange={(e) => set({ photoUrl: e.target.value })} />
          </Field>
        </div>
      </div>
      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <Field label="Full name" hint="Your name comes from your account.">
          <input className="input" value={form._name} disabled />
        </Field>
        <Field label="Years teaching" error={errors.experienceYears}>
          <input className="input" type="number" min={0} value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value, 10) || 0) })} />
        </Field>
        <Field label="Intro video URL (optional)">
          <input className="input" type="url" placeholder="https://youtube.com/…" value={form.introVideoUrl || ""} onChange={(e) => set({ introVideoUrl: e.target.value })} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Where you teach</Label>
        <LocationPicker value={form.location} onChange={(location) => set({ location })} />
      </div>
    </Section>

    <Section id="teaching" title="About & teaching" sub="This is what students and parents read before they reach out.">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Label>Bio</Label>
          <div className="seg" role="tablist">
            {LANGS.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={bioLang === key} className={`seg-item flex items-center gap-1.5 ${bioLang === key ? "on" : ""}`} onClick={() => setBioLang(key)}>
                {label}
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: form[key]?.trim() ? "var(--primary)" : "var(--lavender)" }} />
              </button>
            ))}
          </div>
        </div>
        <textarea
          rows={6}
          className={`textarea serif text-[17px] ${errors.bio ? "err" : ""}`}
          value={form[bioLang] || ""}
          onChange={(e) => set({ [bioLang]: e.target.value.slice(0, BIO_MAX) })}
          placeholder={bioLang === "bio" ? "Tell students what you teach, how you teach, and who your classes suit best." : "Optional translation. If left empty, readers see your main bio with a note."}
        />
        <div className="flex flex-wrap justify-between gap-3 text-[13px]">
          <span className={errors.bio ? "text-danger" : "text-ink-2"}>
            {errors.bio ||
              (bioLang === "bio"
                ? form.bio.trim().length < BIO_MIN
                  ? `Write at least ${BIO_MIN} characters (${BIO_MIN - form.bio.trim().length} to go).`
                  : "Looks good."
                : "Translations help parents who prefer Sinhala or Tamil.")}
          </span>
          <span className="text-ink-2">{(form[bioLang] || "").length} / {BIO_MAX}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Label>Subjects you teach</Label>
        <ChipSelect options={SUBJECTS} value={form.subjects} onChange={(subjects) => set({ subjects })} />
        {errors.subjects && <span className="field-err">{errors.subjects}</span>}
      </div>

      <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="flex flex-col gap-2.5">
          <Label>Levels</Label>
          <ChipSelect options={GRADES} value={form.grades} onChange={(grades) => set({ grades })} />
          {errors.grades && <span className="field-err">{errors.grades}</span>}
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>Teaching medium</Label>
          <ChipSelect options={MEDIUMS} value={form.medium} onChange={(medium) => set({ medium })} />
          {errors.medium && <span className="field-err">{errors.medium}</span>}
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>Curriculum</Label>
          <ChipSelect options={CURRICULA} value={form.curriculum} onChange={(curriculum) => set({ curriculum })} />
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>How you teach</Label>
          <ChipSelect options={CLASS_TYPES} value={form.classType} onChange={(classType) => set({ classType })} />
          {errors.classType && <span className="field-err">{errors.classType}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Qualifications</Label>
          <button type="button" className="border-0 bg-transparent text-sm font-semibold text-primary" onClick={() => set({ qualifications: [...form.qualifications, ""] })}>
            + Add qualification
          </button>
        </div>
        {form.qualifications.length === 0 && <span className="text-sm text-ink-2">e.g. BSc (Hons) Physics, University of Peradeniya, 2015</span>}
        {form.qualifications.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input h-11"
              value={q}
              placeholder="Qualification, institution and year"
              aria-label={`Qualification ${i + 1}`}
              onChange={(e) => set({ qualifications: form.qualifications.map((x, j) => (j === i ? e.target.value : x)) })}
            />
            <button type="button" aria-label="Remove qualification" className="btn btn-ghost h-9 w-9 p-0 hover:text-danger" onClick={() => set({ qualifications: form.qualifications.filter((_, j) => j !== i) })}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </Section>

    <Section id="verification" dark>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex max-w-[620px] items-start gap-4">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-lg font-bold">✓</span>
          <div className="flex flex-col gap-1.5">
            <span className="serif text-2xl">
              {verification?.verificationTier === "fully_verified"
                ? "You're fully verified"
                : verification?.verificationTier === "id_verified"
                  ? "You're ID verified"
                  : verification?.status === "pending_review"
                    ? "Verification under review"
                    : "Get verified"}
            </span>
            <span className="text-sm leading-relaxed text-on-dark">
              {verification?.status === "approved" && verification?.reviewedAt
                ? `Approved on ${formatDate(verification.reviewedAt)}.`
                : verification?.status === "pending_review"
                  ? `Submitted ${formatDate(verification.submittedAt)}. We review within 48 hours.`
                  : "Verified teachers appear in search and can accept requests for child accounts."}
            </span>
          </div>
        </div>
        <Link to="/verification" className="btn border-blue bg-transparent text-white hover:bg-white/10 hover:text-white" style={{ borderColor: "var(--blue)" }}>
          {verification?.status === "not_submitted" || !verification ? "Start verification" : "Verification details"}
        </Link>
      </div>
    </Section>
  </>
);

// ─── Student (self, or a parent editing a child) ─────────────────────────────
const StudentForm = ({ form, set, errors, forChild }) => (
  <Section id="learning" title="Learning preferences" sub={forChild ? `We use these to recommend teachers for ${forChild}.` : "We use these to recommend teachers on your Home page."}>
    <Field label="Grade / level">
      <select className="select" value={form.gradeOrLevel || ""} onChange={(e) => set({ gradeOrLevel: e.target.value })}>
        <option value="">Choose a level</option>
        {GRADES.map((g) => <option key={g}>{g}</option>)}
        {form.gradeOrLevel && !GRADES.includes(form.gradeOrLevel) && <option>{form.gradeOrLevel}</option>}
      </select>
    </Field>
    <div className="flex flex-col gap-2.5">
      <Label>Subjects {forChild ? `${forChild} needs` : "you need"} help with</Label>
      <ChipSelect options={SUBJECTS} value={form.subjectsInterested} onChange={(subjectsInterested) => set({ subjectsInterested })} />
      {errors.subjectsInterested && <span className="field-err">{errors.subjectsInterested}</span>}
    </div>
    <div className="flex flex-col gap-2.5">
      <Label>Preferred medium</Label>
      <ChipSelect options={MEDIUMS} value={form.medium} onChange={(medium) => set({ medium })} />
    </div>
    <div className="flex flex-col gap-2">
      <Label>Location</Label>
      <LocationPicker value={form.location} onChange={(location) => set({ location })} hint="Used to find teachers near you. Teachers never see an exact address." />
    </div>
  </Section>
);

const ProfileEditPage = () => {
  const { user } = useAuth();
  const role = user.role;
  const children = role === "parent" ? user.linkedChildIds || [] : [];
  const [childId, setChildId] = useState(children[0]?._id || "");
  const targetId = role === "parent" ? childId : user._id;
  const child = children.find((c) => c._id === childId);

  const { data: loaded, loading } = useAsync(
    () =>
      role === "teacher"
        ? profilesApi.getTeacher(user._id).then((d) => d.profile).catch((e) => (e.response?.status === 404 ? null : Promise.reject(e)))
        : profilesApi.getStudent(targetId).then((d) => d.profile).catch((e) => (e.response?.status === 404 ? null : Promise.reject(e))),
    [role, targetId],
    { enabled: Boolean(targetId) }
  );
  const { data: verification } = useAsync(() => verificationApi.me(), [], { enabled: role === "teacher" });

  const initial = useMemo(
    () => (role === "teacher" ? { ...pickTeacher(loaded), _name: user.name } : pickStudent(loaded)),
    [loaded, role, user.name]
  );
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [bioLang, setBioLang] = useState("bio");

  // Re-seed the form when the loaded profile (or selected child) changes.
  const [seededFrom, setSeededFrom] = useState(initial);
  if (seededFrom !== initial) {
    setSeededFrom(initial);
    setForm(initial);
    setDirty(false);
    setErrors({});
  }

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k === "bio_si" || k === "bio_ta" ? "bio" : k]);
      return next;
    });
  };

  const checklist =
    role === "teacher"
      ? [
          ["Profile photo", Boolean(form.photoUrl)],
          [`Bio at least ${BIO_MIN} characters`, (form.bio || "").trim().length >= BIO_MIN],
          ["At least one subject", form.subjects?.length > 0],
          ["Qualification added", form.qualifications?.some((q) => q.trim())],
          ["Location set", Boolean(form.location)],
          ["Bio in a second language", Boolean(form.bio_si?.trim() || form.bio_ta?.trim())],
        ]
      : [
          ["Grade selected", Boolean(form.gradeOrLevel)],
          ["At least one subject", form.subjectsInterested?.length > 0],
          ["Medium chosen", form.medium?.length > 0],
          ["Location set", Boolean(form.location)],
        ];
  const pct = Math.round((checklist.filter((c) => c[1]).length / checklist.length) * 100);

  const validate = () => {
    const e = {};
    if (role === "teacher") {
      if (!form.subjects.length) e.subjects = "Choose at least one subject";
      if (!form.grades.length) e.grades = "Choose at least one level";
      if (!form.medium.length) e.medium = "Choose at least one medium";
      if (!form.classType.length) e.classType = "Choose at least one way you teach";
      if (form.bio.trim().length < BIO_MIN) e.bio = `Your bio needs at least ${BIO_MIN} characters.`;
    }
    return e;
  };

  const save = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      toast.error("Fix the highlighted fields to save.");
      return;
    }
    setSaving(true);
    try {
      if (role === "teacher") {
        await profilesApi.upsertTeacher({
          subjects: form.subjects,
          grades: form.grades,
          medium: form.medium,
          curriculum: form.curriculum,
          classType: form.classType,
          bio: form.bio.trim(),
          bio_si: form.bio_si?.trim() || null,
          bio_ta: form.bio_ta?.trim() || null,
          qualifications: form.qualifications.map((q) => q.trim()).filter(Boolean),
          experienceYears: Number(form.experienceYears) || 0,
          photoUrl: form.photoUrl?.trim() || null,
          introVideoUrl: form.introVideoUrl?.trim() || null,
          ...(form.location ? { location: form.location } : {}),
        });
      } else {
        await profilesApi.upsertStudent({
          targetUserId: targetId,
          gradeOrLevel: form.gradeOrLevel || null,
          subjectsInterested: form.subjectsInterested,
          medium: form.medium,
          ...(form.location ? { location: form.location } : {}),
        });
      }
      setDirty(false);
      toast.success("Profile saved");
    } catch (err) {
      toast.error(apiError(err, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  if (role === "parent" && children.length === 0) {
    return (
      <div className="shell-narrow py-12">
        <div className="card">
          <EmptyState icon="users" title="Add a child first" action={<Link to="/children" className="btn btn-primary">Add a child</Link>}>
            Profiles on a parent account belong to your children. Add a child to set their grade, subjects and preferences.
          </EmptyState>
        </div>
      </div>
    );
  }

  const sections =
    role === "teacher"
      ? [["basic", "Basic information"], ["teaching", "About & teaching"], ["verification", "Verification"], ["account", "Account"]]
      : [["learning", "Learning preferences"], ["account", "Account"]];

  return (
    <div className="shell-narrow flex flex-col gap-7 pb-36 pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{role} account</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>
            {role === "parent" ? "Children's profiles" : "Edit profile"}
          </h1>
        </div>
        {role === "teacher" && <Link to={`/teachers/${user._id}`} className="btn btn-outline btn-sm">View public profile ↗</Link>}
      </div>

      {role === "parent" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-ink-2">Editing profile for</span>
          <div className="flex rounded-full bg-mist p-1" role="tablist">
            {children.map((c) => {
              const on = c._id === childId;
              return (
                <button
                  key={c._id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => {
                    if (dirty && !window.confirm("Discard unsaved changes?")) return;
                    setChildId(c._id);
                  }}
                  className="flex items-center gap-2 rounded-full border-0 py-[7px] pl-2 pr-4 text-sm font-semibold"
                  style={{ background: on ? "#fff" : "transparent", color: on ? "var(--ink)" : "var(--ink-2)", boxShadow: on ? "0 1px 3px rgba(22,27,63,.15)" : "none" }}
                >
                  <Avatar name={c.name} size={26} solid={on} />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-9">
        <aside className="sticky top-[104px] flex flex-col gap-4" style={{ flex: "1 1 240px", maxWidth: 280 }}>
          <nav className="card flex flex-col gap-0.5 p-2" aria-label="Sections">
            {sections.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="flex items-center justify-between rounded-[10px] px-3.5 py-[11px] text-[15px] font-medium text-ink hover:bg-mist hover:text-ink">
                {label}
                {((id === "basic" && errors.experienceYears) || (id === "teaching" && (errors.subjects || errors.bio || errors.grades || errors.medium || errors.classType))) && (
                  <span className="text-xs text-danger">●</span>
                )}
              </a>
            ))}
          </nav>
          <div className="card-mist flex flex-col gap-3 rounded-2xl p-5">
            <div className="flex items-baseline justify-between">
              <span className="serif text-lg font-bold">Profile strength</span>
              <span className="text-sm font-bold text-primary">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-white">
              <div className="h-full rounded bg-primary transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex flex-col gap-[7px]">
              {checklist.map(([label, ok]) => (
                <span key={label} className="flex items-center gap-2 text-[13px]" style={{ color: ok ? "var(--ink)" : "var(--ink-2)" }}>
                  <span
                    className="flex h-4 w-4 flex-none items-center justify-center rounded-full border-[1.5px] text-[9px] text-white"
                    style={{ borderColor: ok ? "var(--primary)" : "var(--lavender)", background: ok ? "var(--primary)" : "#fff" }}
                  >
                    {ok ? "✓" : ""}
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6" style={{ flex: "999 1 520px" }}>
          {loading ? (
            <PageLoader />
          ) : (
            <>
              {!loaded && (
                <div className="rounded-xl border bg-mist px-5 py-4 text-sm" style={{ borderColor: "var(--lavender)" }}>
                  {role === "teacher"
                    ? "You haven't built your teaching profile yet. Fill in the fields below and save — students can find you once you're verified."
                    : "No preferences saved yet. Add a few so we can recommend the right teachers."}
                </div>
              )}
              {role === "teacher" ? (
                <TeacherForm form={form} set={set} errors={errors} bioLang={bioLang} setBioLang={setBioLang} verification={verification} />
              ) : (
                <StudentForm form={form} set={set} errors={errors} forChild={child?.name} />
              )}
            </>
          )}

          <Section id="account" title="Account" sub="Your sign-in details. Contact support to change your email or phone.">
            {[
              ["Name", user.name],
              ["Email", user.email, user.emailVerified],
              ["Mobile", user.phone, user.phoneVerified],
            ].map(([label, value, verified]) => (
              <div key={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4">
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[13px] text-ink-2">{label}</span>
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {value}
                    {verified && <StatusBadge status="approved" label="✓ Verified" />}
                  </span>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist pt-4">
              <div className="flex flex-col gap-[3px]">
                <span className="text-[13px] text-ink-2">Password</span>
                <span className="text-[15px] font-semibold">••••••••</span>
              </div>
              <Link to="/forgot-password" className="btn btn-soft btn-sm">Reset password</Link>
            </div>
          </Section>
        </div>
      </div>

      {dirty && (
        <div
          className="rise fixed bottom-[22px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3.5 rounded-[14px] bg-ink py-3 pl-5 pr-3 text-white"
          style={{ width: "min(640px, calc(100% - 32px))", boxShadow: "0 24px 50px -16px rgba(22,27,63,.55)" }}
          role="status"
        >
          <span className="h-2 w-2 flex-none rounded-full bg-blue" />
          <span className="flex-1 text-sm font-medium">{Object.keys(errors).length ? "Fix the highlighted fields to save." : "You have unsaved changes"}</span>
          <button type="button" className="border-0 bg-transparent px-3.5 py-2.5 text-sm font-semibold text-lavender hover:text-white" onClick={() => { setForm(initial); setDirty(false); setErrors({}); }}>
            Discard
          </button>
          <button type="button" className="btn btn-light btn-sm" onClick={save} disabled={saving}>
            {saving && <Spinner />} {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileEditPage;
