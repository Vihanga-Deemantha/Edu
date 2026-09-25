import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Modal, PageLoader, Pagination, Spinner, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import { adminApi } from "../../api/endpoints.js";
import { apiError, formatPrice, relativeTime } from "../../lib/format.js";

const FILTERS = [
  ["flagged", "Flagged"],
  ["active", "Active"],
  ["closed", "Closed"],
  ["", "All"],
];

const AdminListingsPage = () => {
  const { refreshCounts } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "flagged";
  const q = params.get("q") || "";
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState(null); // { listing, to }
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useAsync(() => adminApi.listings({ status: status || undefined, q: q || undefined, page, limit: 24 }), [status, q, page]);

  if (loading && !data) return <PageLoader />;
  const listings = data?.listings || [];

  const moderate = async () => {
    setBusy(true);
    try {
      await adminApi.moderateListing(acting.listing._id, { status: acting.to, adminNotes: notes.trim() || null });
      toast.success(acting.to === "flagged" ? "Listing flagged and hidden from search." : "Listing restored and live.");
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

  return (
    <div className="rise flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(([k, label]) => {
          const countKey = k || "all";
          return (
            <button key={label} type="button" aria-pressed={status === k} className={`chip font-semibold ${status === k ? "on" : ""}`} onClick={() => { const n = new URLSearchParams(params); n.set("status", k); setParams(n); setPage(1); }}>
              {label} · {data?.counts?.[countKey] ?? 0}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {listings.map((l) => (
          <div key={l._id} className="card flex flex-col gap-3 p-5" style={{ borderColor: l.status === "flagged" ? "#E8B4B0" : "var(--line)" }}>
            <div className="flex items-center justify-between gap-2.5">
              <StatusBadge status={l.status} className="text-[11px]" />
              <span className="text-xs text-ink-2">
                {l.reportCount ? `${l.reportCount} report${l.reportCount > 1 ? "s" : ""}${l.pendingReportCount ? ` · ${l.pendingReportCount} open` : ""}` : "No reports"}
              </span>
            </div>
            <Link to={`/listings/${l._id}`} target="_blank" className="serif text-lg font-bold leading-snug text-ink hover:text-primary">
              {l.type === "student_ad" ? "Wanted: " : ""}{l.subject} · {l.grade}
            </Link>
            <span className="text-[13px] text-ink-2">
              by {l.owner?.name || "unknown"} · {formatPrice(l.price) || "no price"} · updated {relativeTime(l.updatedAt).toLowerCase()}
            </span>
            <span className="line-clamp-3 rounded-lg bg-tint px-3 py-2.5 text-[13px] leading-normal text-ink-2">{l.description}</span>
            <div className="mt-auto flex gap-2">
              {l.status === "flagged" ? (
                <button type="button" className="btn btn-primary btn-sm flex-1" onClick={() => setActing({ listing: l, to: "active" })}>Restore</button>
              ) : (
                l.status === "active" && <button type="button" className="btn btn-danger btn-sm flex-1" onClick={() => setActing({ listing: l, to: "flagged" })}>Flag & hide</button>
              )}
              <Link to={`/listings/${l._id}`} target="_blank" className="btn btn-soft btn-sm flex-1">Open ↗</Link>
            </div>
          </div>
        ))}
      </div>
      {listings.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center text-sm text-ink-2" style={{ borderColor: "var(--lavender)" }}>
          {q ? `No listings match “${q}”.` : status === "flagged" ? "No flagged listings. Nothing to review." : "No listings in this view."}
        </div>
      )}
      <Pagination page={page} limit={24} total={data?.pagination?.total || 0} onChange={setPage} />

      <Modal open={Boolean(acting)} onClose={() => !busy && setActing(null)} title={acting?.to === "flagged" ? "Flag this listing?" : "Restore this listing?"} width={460}>
        {acting && (
          <div className="flex flex-col gap-4 p-6">
            <span className="text-sm text-ink-2">
              {acting.to === "flagged" ? "It will be hidden from search. You can restore it later." : "It goes back into search immediately."}
            </span>
            <label className="field">
              <span className="field-label">Admin notes (optional, kept in the audit log)</span>
              <textarea rows={3} className="textarea min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={() => setActing(null)}>Cancel</button>
              <button type="button" className={`btn ${acting.to === "flagged" ? "bg-danger text-white hover:opacity-90" : "btn-primary"}`} disabled={busy} onClick={moderate}>
                {busy && <Spinner dark={false} />} {acting.to === "flagged" ? "Flag listing" : "Restore"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminListingsPage;
