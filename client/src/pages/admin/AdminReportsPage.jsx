import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Modal, PageLoader, Pagination, Spinner, StatusBadge, Stars } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import { adminApi } from "../../api/endpoints.js";
import { apiError, relativeTime, roleLabel } from "../../lib/format.js";

const FILTERS = [
  ["pending", "Open"],
  ["resolved", "Resolved"],
  ["dismissed", "Dismissed"],
  ["", "All"],
];

/** One action = resolve/dismiss the report, optionally with a side effect on the target first. */
const actionsFor = (r) => {
  const base = [{ key: "dismiss", label: "Dismiss", status: "dismissed", tone: "soft" }];
  if (r.targetType === "listing" && r.target?.status !== "flagged") {
    return [{ key: "flag", label: "Flag listing & resolve", status: "resolved", tone: "primary", effect: "flag" }, { key: "resolve", label: "Resolve without action", status: "resolved", tone: "soft" }, ...base];
  }
  if (r.targetType === "user" && r.target?.isActive !== false) {
    return [{ key: "resolve", label: "Resolve (warned)", status: "resolved", tone: "primary" }, { key: "suspend", label: "Suspend account & resolve", status: "resolved", tone: "danger", effect: "suspend" }, ...base];
  }
  return [{ key: "resolve", label: "Mark resolved", status: "resolved", tone: "primary" }, ...base];
};

const AdminReportsPage = () => {
  const { refreshCounts } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "pending";
  const q = (params.get("q") || "").toLowerCase();
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState(null); // { report, action }
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => adminApi.reports({ status: status || undefined, page, limit: 20 }), [status, page]);

  if (loading && !data) return <PageLoader />;
  const reports = (data?.reports || []).filter(
    (r) => !q || `${r.reason} ${r.target?.subject || ""} ${r.target?.name || ""} ${r.target?.teacherName || ""} ${r.target?.ownerName || ""}`.toLowerCase().includes(q)
  );

  const run = async () => {
    const { report, action } = acting;
    if (action.effect === "suspend" && !notes.trim()) {
      toast.error("Add a note explaining the suspension.");
      return;
    }
    setBusy(true);
    try {
      if (action.effect === "flag") await adminApi.moderateListing(report.targetId, { status: "flagged", adminNotes: notes.trim() || `Report: ${report.reason}` });
      if (action.effect === "suspend") await adminApi.suspendUser(report.targetId, notes.trim());
      await adminApi.resolveReport(report._id, { status: action.status, adminNotes: notes.trim() || null });
      toast.success(action.status === "dismissed" ? "Report dismissed." : "Report resolved.");
      setActing(null);
      setNotes("");
      reload();
      refreshCounts();
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const targetLine = (r) => {
    const t = r.target;
    if (!t) return <span className="text-ink-2">The reported {r.targetType} no longer exists.</span>;
    if (r.targetType === "listing") return <>Listing: <b className="text-ink">{t.subject} · {t.grade}</b> by {t.ownerName || "unknown"} <StatusBadge status={t.status} className="ml-1 text-[11px]" /></>;
    if (r.targetType === "user") return <>{roleLabel(t.role)}: <b className="text-ink">{t.name}</b> {t.isActive === false && <StatusBadge status="suspended" className="ml-1 text-[11px]" />}</>;
    return <>Review on <b className="text-ink">{t.teacherName || "a teacher"}</b>'s profile</>;
  };

  return (
    <div className="rise flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, label]) => (
          <button key={label} type="button" aria-pressed={status === k} className={`chip font-semibold ${status === k ? "on" : ""}`} onClick={() => { const n = new URLSearchParams(params); n.set("status", k); setParams(n); setPage(1); }}>
            {label}
          </button>
        ))}
      </div>

      {reports.map((r) => {
        const open = r.status === "pending";
        return (
          <div key={r._id} className="card flex flex-wrap items-center gap-4 px-5 py-[18px]" style={{ opacity: open ? 1 : 0.75 }}>
            <div className="flex min-w-0 flex-col gap-1.5" style={{ flex: "1 1 360px" }}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={open ? "pending" : r.status} label={open ? "Open" : undefined} className="text-[11px]" />
                <span className="text-xs capitalize text-ink-2">{r.targetType} · {relativeTime(r.createdAt)} · #{r._id.slice(-6).toUpperCase()}</span>
              </div>
              <span className="serif text-lg font-bold">{r.reason}</span>
              <span className="text-sm text-ink-2">
                {targetLine(r)} · Reported by {r.reporter ? `${r.reporter.name} (${roleLabel(r.reporter.role).toLowerCase()})` : "a user"}
              </span>
              {r.targetType === "review" && r.target && (
                <div className="flex flex-col gap-1 rounded-lg bg-tint px-3 py-2.5 text-sm leading-normal">
                  <Stars value={r.target.rating} />
                  {r.target.comment ? `“${r.target.comment}”` : <span className="text-ink-2">No comment text.</span>}
                </div>
              )}
              {r.targetType === "listing" && r.target && (
                <Link to={`/listings/${r.targetId}`} target="_blank" className="self-start text-[13px] font-semibold">Open listing ↗</Link>
              )}
              {r.targetType === "user" && r.target?.role === "teacher" && (
                <Link to={`/teachers/${r.targetId}`} target="_blank" className="self-start text-[13px] font-semibold">Open profile ↗</Link>
              )}
            </div>
            {open && (
              <div className="flex min-w-[200px] flex-none flex-col gap-2">
                {actionsFor(r).map((a) => (
                  <button key={a.key} type="button" className={`btn btn-sm ${a.tone === "primary" ? "btn-primary" : a.tone === "danger" ? "btn-danger" : "btn-soft"}`} onClick={() => { setActing({ report: r, action: a }); setNotes(""); }}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {reports.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-ink-2" style={{ borderColor: "var(--lavender)" }}>No reports in this view.</div>
      )}
      <Pagination page={page} limit={20} total={data?.pagination?.total || 0} onChange={setPage} />

      <Modal open={Boolean(acting)} onClose={() => !busy && setActing(null)} title={acting?.action.label} width={480}>
        {acting && (
          <div className="flex flex-col gap-4 p-6">
            <span className="text-sm text-ink-2">
              {acting.action.effect === "suspend"
                ? "Suspending ends every session for this account immediately, including any open chat. The user can't sign in until unsuspended."
                : acting.action.effect === "flag"
                  ? "The listing is hidden from search until an admin restores it."
                  : "The report is closed and kept in the audit log."}
            </span>
            <label className="field">
              <span className="field-label">Admin notes {acting.action.effect === "suspend" ? "(required)" : "(optional)"}</span>
              <textarea rows={3} className="textarea min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What you checked and why you decided this" />
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={() => setActing(null)}>Cancel</button>
              <button type="button" className={`btn ${acting.action.tone === "danger" ? "bg-danger text-white hover:opacity-90" : "btn-primary"}`} disabled={busy} onClick={run}>
                {busy && <Spinner dark={false} />} Confirm
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminReportsPage;
