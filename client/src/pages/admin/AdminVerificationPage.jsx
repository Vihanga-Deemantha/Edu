import { useState } from "react";
import useNow from "../../hooks/useNow.js";
import { useOutletContext, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon.jsx";
import { Avatar, PageLoader, Spinner, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import { adminApi, verificationApi } from "../../api/endpoints.js";
import { apiError, formatDate, formatDateTime, relativeTime } from "../../lib/format.js";

const FILTERS = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["all", "All"],
];
const REJECT_REASONS = ["Document unclear", "Name mismatch", "Police report too old", "Selfie doesn't match ID"];

const ReviewPanel = ({ userId, onDone }) => {
  const now = useNow();
  const { data, loading, reload } = useAsync(() => adminApi.verification(userId), [userId]);
  const [checked, setChecked] = useState({});
  const [opening, setOpening] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);


  if (loading || !data) return <div className="card flex flex-1 items-center justify-center gap-2 rounded-[18px] p-10 text-sm text-ink-2"><Spinner /> Loading submission…</div>;
  const v = data.verification;
  const pending = v.status === "pending_review";
  const docs = v.documents;
  const allChecked = docs.length > 0 && docs.every((d) => checked[d.field]);
  const hasPolice = docs.some((d) => d.field === "policeClearanceUrl");
  const tier = hasPolice ? "fully_verified" : "id_verified";
  const policeAgeMonths = v.policeClearanceIssuedAt ? (now - new Date(v.policeClearanceIssuedAt)) / (30 * 86400000) : null;

  const openDoc = async (d) => {
    setOpening(d.field);
    try {
      const { url } = await verificationApi.documentUrl(userId, d.field);
      window.open(url, "_blank", "noopener");
      if (pending) setChecked((c) => ({ ...c, [d.field]: true }));
    } catch (e) {
      toast.error(apiError(e, "Couldn't open that document."));
    } finally {
      setOpening(null);
    }
  };

  const review = async (status) => {
    if (status === "rejected" && !reason && !note.trim()) {
      setErr("Choose or write a reason so the decision is on record.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.reviewVerification(userId, {
        status,
        // Rejecting keeps whatever tier was already granted (e.g. a rejected police report doesn't revoke ID verification).
        verificationTier: status === "approved" ? tier : v.verificationTier,
        adminNotes: [reason, note.trim()].filter(Boolean).join(" — ") || null,
      });
      toast.success(status === "approved" ? `${v.name}: ${tier === "fully_verified" ? "fully verified" : "ID verified"}. Badge is live.` : `${v.name}: rejected.`);
      onDone();
      reload();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const checks = [
    ["Name matches profile and ID", allChecked],
    ["Selfie face matches ID photo", docs.some((d) => d.field === "selfieWithIdUrl") ? allChecked : null],
    ["Police report issued in the last 6 months", hasPolice ? (policeAgeMonths !== null ? policeAgeMonths <= 6 : allChecked) : null],
  ].filter((c) => c[1] !== null);

  return (
    <section className="card rise flex min-w-0 flex-col gap-5 rounded-[18px] p-6" style={{ flex: "999 1 480px" }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Avatar name={v.name} size={56} solid />
          <div className="flex flex-col gap-[3px]">
            <span className="serif text-[26px] leading-tight">{v.name}</span>
            <span className="text-[13px] text-ink-2">
              {[v.profile?.subjects?.slice(0, 2).join(", "), v.email, v.submittedAt ? `submitted ${formatDateTime(v.submittedAt)}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="grid gap-3 text-sm" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <div className="flex flex-col gap-0.5"><span className="eyebrow-muted text-[11px]">NIC / passport no.</span><span className="font-semibold">{v.nicNumber}</span></div>
        <div className="flex flex-col gap-0.5"><span className="eyebrow-muted text-[11px]">Phone</span><span className="font-semibold">{v.phone}</span></div>
        <div className="flex flex-col gap-0.5"><span className="eyebrow-muted text-[11px]">Current tier</span><span className="font-semibold">{v.verificationTier === "none" ? "None" : v.verificationTier === "id_verified" ? "ID verified" : "Fully verified"}</span></div>
        {v.policeClearanceIssuedAt && <div className="flex flex-col gap-0.5"><span className="eyebrow-muted text-[11px]">Police report issued</span><span className="font-semibold">{formatDate(v.policeClearanceIssuedAt)}</span></div>}
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {docs.map((d) => {
          const on = checked[d.field] || !pending;
          return (
            <button key={d.field} type="button" onClick={() => openDoc(d)} className="flex flex-col gap-2 border-0 bg-transparent p-0 text-left">
              <div
                className="relative flex h-[110px] w-full items-center justify-center rounded-[10px] border-[1.5px] text-[11px] font-bold text-periwinkle"
                style={{ borderColor: on ? "var(--primary)" : "var(--line)", background: "repeating-linear-gradient(135deg, var(--line-soft) 0 8px, var(--mist) 8px 16px)" }}
              >
                {opening === d.field ? <Spinner /> : <Icon name="file" size={28} />}
                <span
                  className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] text-[10px] text-white"
                  style={{ background: on ? "var(--primary)" : "#fff", borderColor: on ? "var(--primary)" : "var(--lavender)" }}
                >
                  {on ? "✓" : ""}
                </span>
              </div>
              <span className="text-[13px] font-semibold text-ink">{d.label}</span>
            </button>
          );
        })}
        {docs.length === 0 && <span className="text-sm text-ink-2">No documents on file.</span>}
      </div>

      {v.qualificationDocuments?.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm">
          <span className="eyebrow-muted text-xs">Qualifications</span>
          {v.qualificationDocuments.map((q) => <span key={q.title}>{q.title} · {q.issuer}</span>)}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-mist p-4">
        <span className="text-xs font-bold tracking-[.1em] text-ink-2">{pending ? "CHECKLIST · OPEN EACH DOCUMENT TO MARK IT CHECKED" : "REVIEW"}</span>
        {pending ? (
          checks.map(([t, ok]) => (
            <span key={t} className="flex gap-2 text-[13px]"><b style={{ color: ok ? "var(--primary)" : "var(--periwinkle)" }}>{ok ? "✓" : "○"}</b>{t}</span>
          ))
        ) : (
          <span className="text-[13px]">
            {v.reviewedAt ? `Reviewed ${formatDateTime(v.reviewedAt)}.` : "Not reviewed yet."}
            {v.adminNotes ? ` Notes: “${v.adminNotes}”` : ""}
          </span>
        )}
      </div>

      {pending && (
        <div className="flex flex-col gap-2.5">
          {rejecting && (
            <div className="rise flex flex-col gap-2">
              <span className="text-sm font-semibold">Reason (kept on the review record)</span>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_REASONS.map((r) => (
                  <button key={r} type="button" aria-pressed={reason === r} className={`chip ${reason === r ? "on" : ""}`} onClick={() => { setReason(reason === r ? "" : r); setErr(""); }}>{r}</button>
                ))}
              </div>
              <textarea rows={2} className={`textarea min-h-0 text-sm ${err ? "err" : ""}`} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} placeholder="Add details, e.g. which document and what to fix" />
              {err && <span className="field-err">{err}</span>}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" className="btn btn-danger" disabled={busy} onClick={() => (rejecting ? review("rejected") : setRejecting(true))}>
              {rejecting ? "Confirm rejection" : "Reject"}
            </button>
            {rejecting ? (
              <button type="button" className="btn btn-ghost" onClick={() => { setRejecting(false); setErr(""); }}>Cancel</button>
            ) : (
              <button
                type="button"
                className="btn btn-primary px-[22px]"
                disabled={busy || !allChecked}
                title={allChecked ? undefined : "Open and check every document first"}
                onClick={() => review("approved")}
              >
                {busy && <Spinner dark={false} />} Approve · {tier === "fully_verified" ? "Fully verified" : "ID verified"}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const AdminVerificationPage = () => {
  const { refreshCounts } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const status = params.get("status") || "pending";
  const q = params.get("q") || "";
  const { data, loading, reload } = useAsync(() => adminApi.verifications({ status, q: q || undefined, limit: 50 }), [status, q]);
  const list = data?.verifications || [];
  const selId = params.get("sel") || list[0]?.userId;

  const setParam = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  if (loading && !data) return <PageLoader />;

  return (
    <div className="rise flex flex-wrap items-start gap-5">
      <section className="card overflow-hidden rounded-[18px]" style={{ flex: "1 1 340px", maxWidth: 440 }}>
        <div className="flex flex-wrap gap-1.5 border-b border-mist px-4 py-3.5">
          {FILTERS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} className={`chip text-xs font-semibold ${status === k ? "on" : ""}`} onClick={() => setParam({ status: k, sel: "" })}>
              {label} · {data?.counts?.[k] ?? 0}
            </button>
          ))}
        </div>
        {list.map((v) => {
          const sel = v.userId === selId;
          const hours = v.submittedAt ? Math.round((now - new Date(v.submittedAt)) / 3600000) : 0;
          return (
            <button
              key={v.userId}
              type="button"
              onClick={() => setParam({ sel: v.userId })}
              className="divider-row relative flex w-full items-center gap-3 border-0 px-4 py-3.5 text-left hover:bg-tint"
              style={{ background: sel ? "var(--page)" : "#fff" }}
            >
              {sel && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
              <Avatar name={v.name} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{v.name}</div>
                <div className="truncate text-xs text-ink-2">
                  {v.hasPoliceClearance ? "Level 2" : "Level 1"} · {v.documentCount} docs · {relativeTime(v.submittedAt)}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={v.status} className="text-[11px]" />
                {v.status === "pending_review" && hours > 48 && <span className="text-[11px] font-bold text-danger">{hours}h · overdue</span>}
              </div>
            </button>
          );
        })}
        {list.length === 0 && <div className="px-5 py-10 text-center text-sm text-ink-2">{q ? `No submissions match “${q}”.` : "Queue is clear."}</div>}
      </section>

      {selId && (
        <ReviewPanel
          key={selId}
          userId={selId}
          onDone={() => {
            reload();
            refreshCounts();
          }}
        />
      )}
    </div>
  );
};

export default AdminVerificationPage;
