import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Field, PageLoader, Spinner } from "../components/ui/index.jsx";
import Icon from "../components/ui/Icon.jsx";
import useAsync from "../hooks/useAsync.js";
import { verificationApi } from "../api/endpoints.js";
import { MAX_UPLOAD_BYTES, uploadVerificationDocument } from "../lib/upload.js";
import { apiError, formatDate, formatDateTime } from "../lib/format.js";

const DOCS = [
  { key: "nicDocumentUrl", title: "National ID or passport", level: "Level 1", hint: "NIC (both sides in one scan or photo) or passport photo page. All corners visible, no glare.", accept: "image/*,application/pdf", acceptLabel: "JPG, PNG or PDF · up to 10 MB", required: true },
  { key: "selfieWithIdUrl", title: "Selfie holding your ID", level: "Level 1", hint: "Hold the ID next to your face. Your face and the ID photo must both be clear.", accept: "image/*", acceptLabel: "JPG or PNG · up to 10 MB", required: true },
  { key: "policeClearanceUrl", title: "Police clearance report", level: "Level 2", hint: "Issued in the last 6 months by Sri Lanka Police. Required to teach child accounts.", accept: "image/*,application/pdf", acceptLabel: "PDF or JPG · up to 10 MB", required: false },
];

const TIERS = [
  { n: 1, tier: "id_verified", name: "ID verified", needs: "Needs documents 1–2: your national ID and a selfie holding it.", unlocks: ["“ID verified” badge on your profile", "Appear in search results", "Accept requests from students and adults"] },
  { n: 2, tier: "fully_verified", name: "Fully verified", needs: "Needs Level 1 plus document 3: a police clearance report from the last 6 months.", unlocks: ["“Fully verified” badge on your profile", "Accept requests for child accounts from parents", "Shown first in parent searches"] },
];

const HEAD = {
  not_submitted: ["Build trust with a verified badge", "Upload your documents once. Verified teachers appear in search, and fully verified teachers can accept requests for children."],
  pending_review: ["Your documents are in review", "We'll send you a notification as soon as a reviewer has checked them. You can keep using EduLink in the meantime."],
  approved: ["You're verified", "Your badge is live on your profile and listings."],
  rejected: ["Your documents need attention", "A reviewer couldn't approve your submission. Upload clear, current documents and resubmit."],
  expired: ["Your verification has expired", "Upload current documents to renew your badge."],
};

const PILL = {
  not_submitted: ["Not verified", "status-muted"],
  pending_review: ["In review", "status-soft"],
  approved: ["Verified", "status-solid"],
  rejected: ["Action needed", "status-danger"],
  expired: ["Expired", "status-danger"],
};

const DocumentCard = ({ doc, num, value, onChange, locked, lockedLabel, uploadsOff }) => {
  const input = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const pick = async (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file is larger than 10 MB.");
      return;
    }
    setError("");
    setProgress(0);
    try {
      const res = await uploadVerificationDocument(file, setProgress);
      if (!res.configured) {
        onChange({ uploadsOff: true });
        setError("Direct uploads aren't set up here yet — paste a link to the document instead.");
      } else {
        onChange({ ref: res.publicId, name: file.name, size: file.size });
      }
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const ext = value?.name?.split(".").pop()?.toUpperCase() || "DOC";
  const done = Boolean(value?.ref);

  return (
    <div className="card flex flex-col gap-3.5 px-[22px] py-5" style={{ borderWidth: 1.5, borderColor: error ? "#E8B4B0" : done || locked ? "var(--lavender)" : "var(--line)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div className="flex min-w-0 items-start gap-3.5" style={{ flex: "1 1 280px" }}>
          <span
            className="serif flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-bold"
            style={{ background: locked ? "var(--primary)" : "var(--mist)", color: locked ? "#fff" : "var(--primary)" }}
          >
            {num}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="serif text-[19px] font-bold">{doc.title}</span>
              <span className="tag text-[11px] font-bold">{doc.level}</span>
              {!doc.required && <span className="text-xs text-ink-2">Optional</span>}
            </span>
            <span className="text-sm leading-normal text-ink-2">{doc.hint}</span>
          </div>
        </div>
        <span className={`status ${locked ? "status-soft" : done ? "status-soft" : progress !== null ? "status-outline" : "status-muted"}`}>
          {locked ? lockedLabel : progress !== null ? "Uploading…" : done ? "Ready to submit" : "Not uploaded"}
        </span>
      </div>

      {!locked &&
        (uploadsOff ? (
          <input
            className="input"
            type="url"
            placeholder="https:// link to the document"
            value={value?.ref || ""}
            onChange={(e) => onChange({ ref: e.target.value.trim(), name: "Linked document" })}
            aria-label={`${doc.title} link`}
          />
        ) : done || progress !== null ? (
          <div className="flex items-center gap-3.5 rounded-xl border border-line bg-page px-3.5 py-3">
            <div className="flex h-[52px] w-11 flex-none items-end justify-center rounded-md border bg-mist pb-1.5 text-[10px] font-bold text-primary" style={{ borderColor: "var(--lavender)" }}>{ext}</div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex justify-between gap-2.5">
                <span className="truncate text-sm font-semibold">{value?.name || "Uploading…"}</span>
                <span className="whitespace-nowrap text-xs text-ink-2">
                  {progress !== null ? `${progress}%` : value?.size ? `${(value.size / 1024 / 1024).toFixed(1)} MB` : ""}
                </span>
              </div>
              {progress !== null && (
                <div className="h-1.5 overflow-hidden rounded-sm bg-line">
                  <div className="h-full rounded-sm bg-primary transition-[width]" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
            {progress === null && (
              <button type="button" className="btn btn-ghost btn-sm hover:text-danger" onClick={() => onChange(null)}>Remove</button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files?.[0]);
            }}
            className="flex flex-wrap items-center justify-center gap-3.5 rounded-xl border-[1.5px] border-dashed bg-page p-[22px] text-center hover:border-primary hover:bg-mist"
            style={{ borderColor: error ? "var(--danger)" : "var(--lavender)" }}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-mist text-primary"><Icon name="upload" /></span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-ink"><span className="text-primary">Click to upload</span> or drag a file here</span>
              <span className="text-[13px] text-ink-2">{doc.acceptLabel}</span>
            </span>
          </button>
        ))}
      <input ref={input} type="file" accept={doc.accept} className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <span className="field-err">{error}</span>}
    </div>
  );
};

const VerificationPage = () => {
  const { data: v, loading, reload } = useAsync(() => verificationApi.me(), []);
  const [docs, setDocs] = useState({});
  const [uploadsOff, setUploadsOff] = useState(false);
  const [nic, setNic] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading || !v) return <PageLoader />;

  const status = v.status;
  const tier = v.verificationTier;
  const locked = status === "pending_review" || status === "approved";
  const [headline, lede] = HEAD[status] || HEAD.not_submitted;
  const [pillLabel, pillClass] = PILL[status] || PILL.not_submitted;
  const readyCount = DOCS.filter((d) => docs[d.key]?.ref).length;

  const setDoc = (key) => (val) => {
    if (val?.uploadsOff) {
      setUploadsOff(true);
      return;
    }
    setDocs((d) => ({ ...d, [key]: val }));
    setErr("");
  };

  const tierState = (t) => {
    if (tier === t.tier || (t.tier === "id_verified" && tier === "fully_verified")) return ["Active", "status-solid", true];
    if (status === "pending_review") return ["In review", "status-soft", false];
    return ["Not started", "status-muted", false];
  };

  const submit = async () => {
    if (!nic.trim()) return setErr("Enter your NIC or passport number.");
    if (!docs.nicDocumentUrl?.ref || !docs.selfieWithIdUrl?.ref) return setErr("Upload your ID and selfie first.");
    if (docs.policeClearanceUrl?.ref && !issuedAt) return setErr("Add the date your police clearance was issued.");
    if (!agree) return setErr("Please confirm the documents are yours.");
    setSubmitting(true);
    try {
      await verificationApi.submit({
        nicNumber: nic.trim(),
        nicDocumentUrl: docs.nicDocumentUrl.ref,
        selfieWithIdUrl: docs.selfieWithIdUrl.ref,
        ...(docs.policeClearanceUrl?.ref
          ? { policeClearanceUrl: docs.policeClearanceUrl.ref, policeClearanceIssuedAt: new Date(issuedAt).toISOString() }
          : {}),
      });
      toast.success("Submitted for review.");
      setDocs({});
      setAgree(false);
      reload();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const timeline = [
    ["Documents submitted", v.submittedAt ? formatDateTime(v.submittedAt) : "Not yet", v.submittedAt ? 2 : 0],
    ["Reviewed by EduLink", v.reviewedAt ? formatDateTime(v.reviewedAt) : status === "pending_review" ? "Usually 1–2 working days" : "", v.reviewedAt ? (status === "rejected" ? 3 : 2) : status === "pending_review" ? 1 : 0],
    [status === "rejected" ? "Resubmit documents" : "Badge live", status === "approved" ? (v.reviewedAt ? `Since ${formatDate(v.reviewedAt)}` : "") : status === "rejected" ? "Waiting for you" : "", status === "approved" ? 2 : status === "rejected" ? 1 : 0],
  ];

  return (
    <div className="shell-narrow flex flex-col gap-8 pb-28 pt-9">
      <nav className="flex flex-wrap gap-2 text-sm text-ink-2" aria-label="Breadcrumb">
        <Link to="/profile/edit">Edit profile</Link><span>/</span><span className="text-ink">Verification</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-[660px] flex-col gap-2.5">
          <span className="eyebrow">Teacher verification</span>
          <h1 style={{ font: "400 clamp(36px,4vw,52px)/1.04 var(--font-display)", letterSpacing: "-.015em", textWrap: "balance" }}>{headline}</h1>
          <p className="lede text-lg">{lede}</p>
        </div>
        <span className={`status ${pillClass} px-3.5 py-2 text-[13px]`}>{pillLabel}</span>
      </div>

      {status === "rejected" && (
        <div className="rise flex items-start gap-4 rounded-[14px] border px-[22px] py-5" style={{ background: "var(--danger-soft)", borderColor: "#E8B4B0" }}>
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-danger font-bold text-white">!</span>
          <div className="flex flex-col gap-1.5">
            <span className="serif text-[19px] font-bold">We couldn't approve your documents</span>
            <span className="text-sm leading-relaxed text-ink-2">
              Common reasons: a blurry or cropped photo, a name that doesn't match your account, or a police report older than 6 months.
              {tier !== "none" ? " Your current badge stays active while you resubmit." : ""}
            </span>
          </div>
        </div>
      )}

      <section className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
        {TIERS.map((t) => {
          const [label, cls, on] = tierState(t);
          const dark = on && t.n === 2;
          return (
            <div
              key={t.n}
              className="flex flex-col gap-4 rounded-[18px] border-[1.5px] p-[26px]"
              style={{ background: dark ? "var(--ink)" : "#fff", color: dark ? "#fff" : "var(--ink)", borderColor: dark ? "var(--ink)" : on ? "var(--primary)" : "var(--line)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span
                    className="flex h-12 w-12 flex-none items-center justify-center rounded-full border-2 text-xl font-bold"
                    style={{ borderColor: on ? (dark ? "var(--blue)" : "var(--primary)") : "var(--lavender)", background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "var(--lavender)" }}
                  >
                    ✓
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold tracking-[.12em]" style={{ color: dark ? "var(--lavender)" : "var(--primary)" }}>LEVEL {t.n}</span>
                    <span className="serif text-[26px] leading-tight">{t.name}</span>
                  </div>
                </div>
                <span className={`status ${dark ? "" : cls}`} style={dark ? { background: "#fff", color: "var(--primary)" } : undefined}>{label}</span>
              </div>
              <span className="text-sm leading-normal" style={{ color: dark ? "var(--on-dark)" : "var(--ink-2)" }}>{t.needs}</span>
              <div className="flex flex-col gap-2 border-t pt-3.5" style={{ borderColor: dark ? "rgba(173,187,218,.3)" : "var(--mist)" }}>
                {t.unlocks.map((u) => (
                  <span key={u} className="flex gap-2.5 text-sm leading-snug"><b style={{ color: dark ? "var(--blue)" : "var(--primary)" }}>✓</b>{u}</span>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap items-start gap-9">
        <section className="flex min-w-0 flex-col gap-4" style={{ flex: "999 1 560px" }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2.5">
            <h2 className="serif text-[32px]">Your documents</h2>
            <span className="text-sm text-ink-2">{locked ? (status === "approved" ? "Approved" : "Submitted") : `${readyCount} of ${DOCS.length} documents ready`}</span>
          </div>

          {!locked && (
            <div className="card grid gap-4 p-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Field label="NIC or passport number">
                <input className="input" value={nic} onChange={(e) => { setNic(e.target.value); setErr(""); }} placeholder="e.g. 199012345678" autoComplete="off" />
              </Field>
              <Field label="Police clearance issued on" hint="Only if you're uploading document 3.">
                <input className="input" type="date" value={issuedAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setIssuedAt(e.target.value)} />
              </Field>
            </div>
          )}

          {DOCS.map((d, i) => {
            const submittedHere = d.key !== "policeClearanceUrl" || Boolean(v.policeClearanceUrl);
            return (
              <DocumentCard
                key={d.key}
                doc={d}
                num={i + 1}
                value={docs[d.key]}
                onChange={setDoc(d.key)}
                uploadsOff={uploadsOff}
                locked={locked && submittedHere}
                lockedLabel={status === "approved" ? "✓ Approved" : "In review"}
              />
            );
          })}

          {locked && status === "approved" && tier === "id_verified" && (
            <div className="rounded-xl bg-mist px-5 py-4 text-sm leading-relaxed">
              To upgrade to <b>Fully verified</b>, email your police clearance report to <a href="mailto:verify@edulink.lk">verify@edulink.lk</a> and a reviewer will add it to your record.
            </div>
          )}

          {!locked && (
            <div className="card flex flex-col gap-4 p-[22px]">
              <label className="flex cursor-pointer items-start gap-3 text-sm leading-normal">
                <input type="checkbox" className="check mt-0.5" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr(""); }} />
                <span>I confirm these documents are genuine and belong to me. I understand EduLink staff will review them and that false documents lead to a permanent ban.</span>
              </label>
              {err && <span className="field-err">{err}</span>}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[13px] text-ink-2">
                  {docs.policeClearanceUrl?.ref ? "Reviews usually take 1–2 working days." : "Submitting Level 1 only. Add the police clearance now to go straight to Level 2."}
                </span>
                <button type="button" className="btn btn-primary btn-lg" onClick={submit} disabled={submitting}>
                  {submitting && <Spinner dark={false} />}
                  {submitting ? "Submitting…" : status === "rejected" || status === "expired" ? "Resubmit for review" : "Submit for review"}
                </button>
              </div>
            </div>
          )}
        </section>

        <aside className="sticky top-[104px] flex flex-col gap-4" style={{ flex: "1 1 300px", maxWidth: 380 }}>
          <div className="card flex flex-col gap-[18px] rounded-[18px] p-6">
            <span className="serif text-xl font-bold">Review timeline</span>
            <div className="flex flex-col">
              {timeline.map(([label, when, state], i) => (
                <div key={label} className="flex gap-3.5">
                  <div className="flex flex-col items-center">
                    <span
                      className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 text-[11px] font-bold text-white"
                      style={{
                        borderColor: state === 2 ? "var(--primary)" : state === 3 ? "var(--danger)" : state === 1 ? "var(--blue)" : "var(--lavender)",
                        background: state === 2 ? "var(--primary)" : state === 3 ? "var(--danger)" : "#fff",
                      }}
                    >
                      {state === 2 ? "✓" : state === 3 ? "!" : ""}
                    </span>
                    {i < timeline.length - 1 && <span className="min-h-[22px] w-0.5 flex-1" style={{ background: state === 2 ? "var(--primary)" : "var(--line)" }} />}
                  </div>
                  <div className="flex flex-col gap-0.5 pb-4">
                    <span className="text-[15px] font-semibold" style={{ color: state ? "var(--ink)" : "var(--ink-2)" }}>{label}</span>
                    {when && <span className="text-[13px] text-ink-2">{when}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card-mist flex flex-col gap-3 rounded-[18px] p-[22px]">
            <span className="serif text-lg font-bold">How we protect your documents</span>
            {["Stored privately and never shown on your profile", "Seen only by EduLink reviewers, through links that expire in minutes", "Used only to verify your identity"].map((t) => (
              <span key={t} className="flex gap-2.5 text-sm leading-normal"><b className="text-primary">✓</b>{t}</span>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default VerificationPage;
