import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Modal, PageLoader, ErrorState } from "../components/ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import useClickOutside from "../hooks/useClickOutside.js";
import { listingsApi } from "../api/endpoints.js";
import { apiError, curriculumLabel, formatNumber, formatPrice, mediumLabel, relativeTime } from "../lib/format.js";

const STATUS = {
  active: { label: "Active", pill: "status-soft", stripe: "var(--primary)" },
  flagged: { label: "Under review", pill: "status-danger", stripe: "var(--danger)" },
  closed: { label: "Closed", pill: "status-muted", stripe: "var(--line)" },
};

const RowMenu = ({ actions }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  if (!actions.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-lg tracking-[1px] text-ink-2 hover:border-primary">
        ···
      </button>
      {open && (
        <div className="popover absolute right-0 z-20 w-[200px] p-1.5" style={{ top: 46 }}>
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={() => { setOpen(false); a.onClick(); }} className="block w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm hover:bg-mist" style={{ color: a.danger ? "var(--danger)" : "var(--ink)" }}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MyListingsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTeacher = user.role === "teacher";
  const { data, loading, error, setData } = useAsync(() => listingsApi.mine(), []);
  const [tab, setTab] = useState("all");
  const [sort, setSort] = useState("recent");
  const [confirm, setConfirm] = useState(null);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState title="We couldn't load your listings">{apiError(error)}</ErrorState>;

  const items = data?.listings || [];
  const children = new Map((user.linkedChildIds || []).map((c) => [String(c._id), c.name]));
  const count = (k) => items.filter((i) => (k === "all" ? i.status !== "closed" : i.status === k)).length;
  const sorters = {
    recent: (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    interest: (a, b) => (b.stats?.interestCount || 0) - (a.stats?.interestCount || 0),
    views: (a, b) => (b.stats?.views30d || 0) - (a.stats?.views30d || 0),
  };
  const list = items.filter((i) => (tab === "all" ? i.status !== "closed" : i.status === tab)).sort(sorters[sort]);
  const open = items.filter((i) => i.status !== "closed");
  const totalViews = open.reduce((n, i) => n + (i.stats?.views30d || 0), 0);
  const totalInterest = open.reduce((n, i) => n + (i.stats?.interestCount || 0), 0);
  const pending = open.reduce((n, i) => n + (i.stats?.pendingInterestCount || 0), 0);

  const setStatus = async (listing, status) => {
    try {
      const res = status === "closed" ? await listingsApi.close(listing._id) : await listingsApi.update(listing._id, { status: "active" });
      setData((d) => ({ ...d, listings: d.listings.map((l) => (l._id === listing._id ? { ...l, status: res.listing.status, updatedAt: res.listing.updatedAt } : l)) }));
      toast.success(status === "closed" ? "Listing closed. It's hidden from search." : "Listing is live again.");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="shell-narrow flex flex-col gap-7 pb-24 pt-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="eyebrow">{user.role}</span>
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>{isTeacher ? "My listings" : "My wanted ads"}</h1>
        </div>
        <Link to="/listings/new" className="btn btn-primary rounded-[10px] px-[22px] py-[13px]">+ Post a new ad</Link>
      </div>

      <section className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {[
          ["Active ads", count("active"), `${count("flagged")} under review · ${count("closed")} closed`, "var(--primary)"],
          ["Views, last 30 days", formatNumber(totalViews), "Across your open ads", "var(--ink)"],
          ["Interest requests", totalInterest, `${pending} awaiting your reply`, "var(--ink)"],
          ["Conversion", totalViews ? `${Math.round((totalInterest / totalViews) * 1000) / 10}%` : "—", "Requests per view", "var(--ink)"],
        ].map(([label, value, sub, color]) => (
          <div key={label} className="card flex flex-col gap-1.5 px-[22px] py-5">
            <span className="text-[13px] text-ink-2">{label}</span>
            <span className="serif text-4xl leading-none" style={{ color }}>{value}</span>
            <span className="text-xs text-ink-2">{sub}</span>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg flex-wrap rounded-[10px] p-1" role="tablist">
          {[["all", "All open"], ["active", "Active"], ["flagged", "Under review"], ["closed", "Closed"]].map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={`seg-item flex items-center gap-2 px-3.5 py-2 text-sm ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
              {label}
              <span className="min-w-5 rounded-[10px] px-1.5 py-px text-center text-[11px]" style={{ background: tab === k ? "var(--primary)" : "#fff", color: tab === k ? "#fff" : "var(--ink-2)" }}>{count(k)}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2.5 text-sm text-ink-2">
          Sort
          <select className="select h-10 w-auto text-sm font-semibold" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="recent">Recently updated</option>
            <option value="interest">Most interest</option>
            <option value="views">Most views</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed bg-white px-8 py-14 text-center" style={{ borderColor: "var(--lavender)" }}>
          <span className="serif text-[28px]">{items.length === 0 ? "You haven't posted anything yet" : "Nothing here"}</span>
          <span className="max-w-[420px] text-[15px] leading-normal text-ink-2">
            {items.length === 0
              ? isTeacher ? "Post your first class ad so students and parents can find you." : "Post a wanted ad and let verified teachers who match reach out to you."
              : "Listings in this state will show up here."}
          </span>
          <Link to="/listings/new" className="btn btn-primary mt-1.5">Post a new ad</Link>
        </div>
      ) : (
        <section className="flex flex-col gap-3">
          {list.map((l) => {
            const st = STATUS[l.status] || STATUS.active;
            const pendingHere = l.stats?.pendingInterestCount || 0;
            const views = l.stats?.views30d || 0;
            const interest = l.stats?.interestCount || 0;
            const closed = l.status === "closed";
            const forChild = children.get(String(l.ownerId));
            const actions = [
              ...(!closed ? [{ label: "Edit ad", onClick: () => navigate(`/listings/${l._id}/edit`) }] : []),
              { label: "View ad", onClick: () => navigate(`/listings/${l._id}`) },
              ...(closed ? [{ label: "Reopen ad", onClick: () => setStatus(l, "active") }] : []),
              ...(!closed ? [{ label: "Close listing", danger: true, onClick: () => setConfirm(l) }] : []),
            ];
            return (
              <div key={l._id} className="relative flex flex-wrap items-stretch rounded-2xl border bg-white" style={{ borderColor: l.status === "flagged" ? "#E8B4B0" : "var(--line)", opacity: closed ? 0.75 : 1 }}>
                <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl" style={{ background: st.stripe }} />
                <div className="flex min-w-0 flex-col gap-2.5 py-5 pl-[26px] pr-[22px]" style={{ flex: "1 1 360px" }}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={`status ${st.pill}`}>{st.label}</span>
                    <span className="text-[13px] text-ink-2">Updated {relativeTime(l.updatedAt).toLowerCase()}</span>
                    {forChild && <span className="status status-outline">For {forChild}</span>}
                  </div>
                  <Link to={`/listings/${l._id}`} className="serif text-[21px] font-bold leading-tight text-ink hover:text-primary">{l.subject} — {l.grade}</Link>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="tag">{mediumLabel(l.medium)} medium</span>
                    {l.curriculum && <span className="tag">{curriculumLabel(l.curriculum)}</span>}
                    {l.price?.amount !== undefined && <span className="tag">{formatPrice(l.price)}</span>}
                  </div>
                  {l.status === "flagged" ? (
                    <span className="rounded-lg px-3 py-2 text-[13px] leading-normal text-danger" style={{ background: "var(--danger-soft)" }}>
                      Hidden from search while EduLink reviews it, usually within 24 hours.
                    </span>
                  ) : pendingHere > 0 ? (
                    <span className="rounded-lg bg-mist px-3 py-2 text-[13px] leading-normal text-primary">
                      {pendingHere} new interest {pendingHere === 1 ? "request" : "requests"} waiting for your reply.
                    </span>
                  ) : null}
                </div>
                <div className="flex min-w-[260px] flex-col border-l border-mist" style={{ flex: "0 1 330px" }}>
                  <div className="grid flex-1 grid-cols-3">
                    {[
                      [formatNumber(views), "Views · 30d"],
                      [interest, "Interest"],
                      [views ? `${Math.round((interest / views) * 1000) / 10}%` : "—", "Conversion"],
                    ].map(([v, label], i) => (
                      <div key={label} className="flex flex-col justify-center gap-1 border-r border-line-soft px-3.5 py-[18px]">
                        <span className="serif text-[28px] leading-none" style={{ color: i === 1 && pendingHere ? "var(--primary)" : "var(--ink)" }}>{v}</span>
                        <span className="text-xs text-ink-2">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-mist px-4 py-3">
                    <Link
                      to={pendingHere ? "/interests?tab=received" : closed ? `/listings/${l._id}` : `/listings/${l._id}/edit`}
                      className="btn btn-outline btn-sm flex-1"
                    >
                      {pendingHere ? "Review requests" : closed ? "View" : "Edit"}
                    </Link>
                    <RowMenu actions={actions} />
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} width={440}>
        {confirm && (
          <div className="flex flex-col gap-3.5 p-7">
            <span className="serif text-[28px] leading-tight">Close this listing?</span>
            <span className="text-[15px] leading-normal text-ink-2">
              “{confirm.subject} — {confirm.grade}” will be removed from search. Current students and chats are not affected, and you can reopen it later.
            </span>
            <div className="mt-1.5 flex justify-end gap-2.5">
              <button type="button" className="btn btn-soft" onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" className="btn bg-danger text-white hover:opacity-90" onClick={() => setStatus(confirm, "closed")}>Close listing</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyListingsPage;
