import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Brand from "../ui/Brand.jsx";
import Icon from "../ui/Icon.jsx";
import { Avatar } from "../ui/index.jsx";
import useAuth from "../../hooks/useAuth.js";
import useAsync from "../../hooks/useAsync.js";
import { adminApi } from "../../api/endpoints.js";

const MENU = [
  ["/admin", "Dashboard", "dashboard", null],
  ["/admin/verification", "Verifications", "shield", "pendingVerifications"],
  ["/admin/reports", "Reports", "flag", "pendingReports"],
  ["/admin/users", "Users", "users", null],
  ["/admin/listings", "Listings", "listings", "flaggedListings"],
];

const TITLES = {
  "/admin": ["Dashboard", "Platform activity and what needs attention today."],
  "/admin/verification": ["Verification queue", "Review teacher documents. Target: within 48 hours."],
  "/admin/reports": ["Reports", "Safety and policy reports from users."],
  "/admin/users": ["Users", "Search, filter and manage accounts."],
  "/admin/listings": ["Listing moderation", "Flag listings that break the rules, or restore them."],
};

const SEARCH_PLACEHOLDER = {
  "/admin": "Search users by name or email",
  "/admin/verification": "Search teachers by name or email",
  "/admin/reports": "Filter reports on this page",
  "/admin/users": "Search users by name or email",
  "/admin/listings": "Search listings by subject or text",
};

/**
 * Admin console shell (design: "EduLink Admin") — sidebar nav with live queue
 * counts, a top bar whose search box drives the current page's `?q=`, and the
 * page title. Pages render through <Outlet /> and can call `refreshCounts`
 * from the outlet context after an action changes a queue.
 */
const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [drawer, setDrawer] = useState(false);
  const { data: statsData, reload: refreshCounts } = useAsync(() => adminApi.stats(), [location.pathname]);
  const queues = statsData?.stats?.queues || {};
  const path = location.pathname.replace(/\/$/, "") || "/admin";
  const [title, sub] = TITLES[path] || TITLES["/admin"];

  // Reset the search box and close the drawer whenever the route changes.
  const routeKey = location.pathname + location.search;
  const [syncedRoute, setSyncedRoute] = useState(routeKey);
  if (syncedRoute !== routeKey) {
    setSyncedRoute(routeKey);
    setQ(params.get("q") || "");
    setDrawer(false);
  }

  const submitSearch = (e) => {
    e.preventDefault();
    if (path === "/admin") {
      navigate(q.trim() ? `/admin/users?q=${encodeURIComponent(q.trim())}` : "/admin/users");
      return;
    }
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    setParams(next);
  };

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {MENU.map(([to, label, icon, countKey]) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/admin"}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm hover:bg-mist hover:text-ink ${isActive ? "bg-mist font-bold text-primary" : "font-medium text-ink"}`
          }
        >
          <Icon name={icon} size={20} strokeWidth={1.5} />
          <span className="flex-1">{label}</span>
          {countKey && queues[countKey] > 0 && (
            <span className="min-w-[22px] rounded-[10px] bg-primary px-[7px] py-0.5 text-center text-[11px] font-bold text-white">{queues[countKey]}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <>
      <div className="px-2 pb-[22px]">
        <Brand to="/admin" size={23} suffix="ADMIN" />
      </div>
      <span className="px-2.5 pb-2 text-[11px] font-bold tracking-[.14em] text-periwinkle">MENU</span>
      {nav}
      <div className="min-h-4 flex-1" />
      <div className="flex flex-col gap-2 rounded-2xl bg-ink p-4 text-white">
        <span className="serif text-lg leading-tight">Verification queue</span>
        <span className="text-xs leading-normal text-lavender">Review new teacher documents within 48 hours.</span>
        <span className="mt-1 text-[11px] text-lavender">
          {queues.pendingVerifications ? `${queues.pendingVerifications} waiting now` : "Queue is clear"}
        </span>
      </div>
      <div className="mx-2 my-4 h-px bg-mist" />
      <span className="px-2.5 pb-2 text-[11px] font-bold tracking-[.14em] text-periwinkle">ACCOUNT</span>
      <Link to="/browse" className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm text-ink hover:bg-mist hover:text-ink">
        <Icon name="search" size={20} strokeWidth={1.5} /> View marketplace
      </Link>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate("/");
        }}
        className="flex items-center gap-3 rounded-[10px] border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink hover:bg-mist"
      >
        <Icon name="logout" size={20} strokeWidth={1.5} /> Log out
      </button>
    </>
  );

  return (
    <div className="flex min-h-screen" style={{ background: "var(--tint)" }}>
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-line bg-white px-4 py-6 lg:flex" style={{ flex: "0 0 240px" }}>
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line" style={{ background: "rgba(246,244,250,.94)", backdropFilter: "blur(10px)" }}>
          <div className="flex items-center gap-5 px-[clamp(16px,3vw,32px)]" style={{ height: 80 }}>
            <button type="button" className="btn btn-ghost -ml-2 p-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
              <Icon name="menu" />
            </button>
            <form onSubmit={submitSearch} role="search" className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-white px-4" style={{ flex: "0 1 420px" }}>
              <Icon name="search" size={18} strokeWidth={2} className="text-primary" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={SEARCH_PLACEHOLDER[path] || "Search"}
                aria-label="Search"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-ink outline-none"
              />
            </form>
            <div className="flex-1" />
            <div className="flex flex-none items-center gap-2.5">
              <Avatar name={user.name} size={40} solid />
              <div className="hidden flex-col leading-tight sm:flex">
                <span className="text-sm font-bold">{user.name}</span>
                <span className="text-xs text-ink-2">Trust & Safety admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-[22px] px-[clamp(16px,3vw,32px)] pb-16 pt-7">
          <div className="flex flex-col gap-1.5">
            <h1 style={{ font: "400 clamp(30px,3.2vw,40px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>{title}</h1>
            <span className="text-sm text-ink-2">{sub}</span>
          </div>
          <Outlet context={{ refreshCounts, queues, stats: statsData?.stats }} />
        </main>
      </div>

      {drawer && (
        <div className="modal-backdrop items-stretch justify-start p-0 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="flex h-full w-[260px] flex-col overflow-y-auto bg-white px-4 py-6">{sidebar}</div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
