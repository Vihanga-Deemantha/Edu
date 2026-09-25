import { Fragment, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Avatar, Modal, PageLoader, Pagination, Spinner, StatusBadge } from "../../components/ui/index.jsx";
import useAsync from "../../hooks/useAsync.js";
import { adminApi } from "../../api/endpoints.js";
import { apiError, formatDate, formatDateTime, roleLabel } from "../../lib/format.js";

const ROLES = [
  ["", "All", "all"],
  ["teacher", "Teachers", "teacher"],
  ["student", "Students", "student"],
  ["parent", "Parents", "parent"],
];
const VER = {
  fully_verified: ["Fully verified", "var(--primary)"],
  id_verified: ["ID verified", "var(--primary)"],
};
const COLS = "minmax(240px,2fr) 100px 150px 110px 110px 150px";

const AuditTrail = ({ userId }) => {
  const { data, loading } = useAsync(() => adminApi.userAudit(userId), [userId]);
  if (loading) return <div className="flex items-center gap-2 px-5 py-3 text-sm text-ink-2"><Spinner /> Loading history…</div>;
  const log = data?.auditLog || [];
  return (
    <div className="border-b border-line-soft bg-page px-5 py-3.5 text-sm">
      <span className="eyebrow-muted text-[11px]">Admin actions on this account</span>
      {log.length === 0 ? (
        <p className="mt-1.5 text-ink-2">No admin actions yet.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-1">
          {log.map((l) => (
            <li key={l._id}>
              <b>{l.action === "user_suspended" ? "Suspended" : l.action === "user_unsuspended" ? "Unsuspended" : l.action}</b> by {l.adminName || "an admin"} · {formatDateTime(l.createdAt)}
              {l.metadata?.adminNotes ? <span className="text-ink-2"> — “{l.metadata.adminNotes}”</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const AdminUsersPage = () => {
  const [params, setParams] = useSearchParams();
  const role = params.get("role") || "";
  const status = params.get("status") || "";
  const q = params.get("q") || "";
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [acting, setActing] = useState(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, setData } = useAsync(
    () => adminApi.users({ role: role || undefined, status: status || undefined, q: q || undefined, page, limit: 25 }),
    [role, status, q, page]
  );

  const setParam = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n);
    setPage(1);
  };

  if (loading && !data) return <PageLoader />;
  const users = data?.users || [];

  const toggle = async () => {
    const suspend = acting.isActive;
    if (suspend && !notes.trim()) {
      toast.error("A reason is required to suspend an account.");
      return;
    }
    setBusy(true);
    try {
      const res = suspend ? await adminApi.suspendUser(acting._id, notes.trim()) : await adminApi.unsuspendUser(acting._id, notes.trim() || null);
      setData((d) => ({ ...d, users: d.users.map((u) => (u._id === acting._id ? { ...u, isActive: res.user.isActive } : u)) }));
      toast.success(`${acting.name} ${suspend ? "suspended" : "reactivated"}`);
      setActing(null);
      setNotes("");
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rise flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map(([k, label, countKey]) => (
            <button key={label} type="button" aria-pressed={role === k} className={`chip font-semibold ${role === k ? "on" : ""}`} onClick={() => setParam("role", k)}>
              {label} · {data?.counts?.[countKey] ?? 0}
            </button>
          ))}
        </div>
        <select className="select h-10 w-auto text-sm font-semibold" value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <div className="min-w-[960px]">
          <div className="grid gap-3 border-b border-line px-5 py-3 text-xs font-bold tracking-[.08em] text-ink-2" style={{ gridTemplateColumns: COLS }}>
            <span>USER</span><span>ROLE</span><span>VERIFICATION</span><span>JOINED</span><span>STATUS</span><span />
          </div>
          {users.map((u) => {
            const ver = u.verification ? VER[u.verification.tier] || [u.verification.status === "pending_review" ? "In review" : "—", u.verification.status === "pending_review" ? "var(--ink-2)" : "var(--lavender)"] : ["—", "var(--lavender)"];
            return (
              <Fragment key={u._id}>
                <div className="grid items-center gap-3 border-b border-line-soft px-5 py-3 text-sm" style={{ gridTemplateColumns: COLS }}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={u.name} size={34} />
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{u.name}</div>
                      <div className="truncate text-xs text-ink-2">{u.email}</div>
                    </div>
                  </div>
                  <span>{roleLabel(u.role)}{u.childCount ? <span className="text-xs text-ink-2"> · {u.childCount} child{u.childCount > 1 ? "ren" : ""}</span> : null}</span>
                  <span className="text-[13px]" style={{ color: ver[1] }}>{ver[0]}</span>
                  <span className="text-ink-2">{formatDate(u.createdAt)}</span>
                  <StatusBadge status={u.isActive ? "active" : "suspended"} className="justify-self-start text-[11px]" />
                  <div className="flex justify-end gap-1.5">
                    <button type="button" className="btn btn-ghost btn-sm px-2.5" onClick={() => setExpanded(expanded === u._id ? null : u._id)}>
                      {expanded === u._id ? "Hide" : "History"}
                    </button>
                    <button type="button" className={`btn btn-sm px-3 ${u.isActive ? "btn-danger" : "btn-soft"}`} onClick={() => { setActing(u); setNotes(""); }}>
                      {u.isActive ? "Suspend" : "Reactivate"}
                    </button>
                  </div>
                </div>
                {expanded === u._id && <AuditTrail userId={u._id} />}
              </Fragment>
            );
          })}
          {users.length === 0 && <div className="p-8 text-center text-sm text-ink-2">{q ? `No users match “${q}”.` : "No users in this view."}</div>}
        </div>
      </div>
      <Pagination page={page} limit={25} total={data?.pagination?.total || 0} onChange={setPage} />

      <Modal open={Boolean(acting)} onClose={() => !busy && setActing(null)} title={acting?.isActive ? `Suspend ${acting?.name}?` : `Reactivate ${acting?.name}?`} width={480}>
        {acting && (
          <div className="flex flex-col gap-4 p-6">
            <span className="text-sm leading-relaxed text-ink-2">
              {acting.isActive
                ? "This signs them out everywhere immediately — including any open chat — and blocks sign-in until you reactivate the account."
                : "They'll be able to sign in again. Old sessions stay ended."}
            </span>
            <label className="field">
              <span className="field-label">{acting.isActive ? "Reason (required, kept in the audit log)" : "Note (optional)"}</span>
              <textarea rows={3} className="textarea min-h-0" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={() => setActing(null)}>Cancel</button>
              <button type="button" className={`btn ${acting.isActive ? "bg-danger text-white hover:opacity-90" : "btn-primary"}`} disabled={busy} onClick={toggle}>
                {busy && <Spinner dark={false} />} {acting.isActive ? "Suspend account" : "Reactivate"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
