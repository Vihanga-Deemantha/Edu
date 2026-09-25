import { useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Brand from "../ui/Brand.jsx";
import Icon from "../ui/Icon.jsx";
import { Avatar } from "../ui/index.jsx";
import NotificationBell from "./NotificationBell.jsx";
import { LanguagePill } from "./LanguageSwitcher.jsx";
import useAuth from "../../hooks/useAuth.js";
import useClickOutside from "../../hooks/useClickOutside.js";
import { roleLabel } from "../../lib/format.js";

// Role-aware primary nav (spec §3.1, matching each Home design's header).
const NAV = {
  student: [
    ["Home", "/dashboard"],
    ["Browse", "/browse"],
    ["Interests", "/interests"],
    ["Chat", "/chat"],
    ["Bookings", "/bookings"],
  ],
  parent: [
    ["Home", "/dashboard"],
    ["Browse", "/browse"],
    ["Children", "/children"],
    ["Interests", "/interests"],
    ["Chat", "/chat"],
    ["Bookings", "/bookings"],
  ],
  teacher: [
    ["Dashboard", "/dashboard"],
    ["My listings", "/listings/mine"],
    ["Interests", "/interests"],
    ["Chat", "/chat"],
    ["Availability", "/availability"],
  ],
  admin: [["Admin console", "/admin"]],
  guest: [
    ["Browse", "/browse"],
    ["For teachers", "/register?role=teacher"],
  ],
};

const ACCOUNT_LINKS = {
  student: [
    ["My profile", "/profile/edit"],
    ["My wanted ads", "/listings/mine"],
    ["Notifications", "/notifications"],
  ],
  parent: [
    ["My children", "/children"],
    ["Children's profiles", "/profile/edit"],
    ["Wanted ads", "/listings/mine"],
    ["Notifications", "/notifications"],
  ],
  teacher: [
    ["Public profile", "/teachers/:me"],
    ["Edit profile", "/profile/edit"],
    ["Verification", "/verification"],
    ["Bookings", "/bookings"],
    ["Notifications", "/notifications"],
  ],
  admin: [["Admin console", "/admin"]],
};

const navClass = ({ isActive }) =>
  `relative whitespace-nowrap rounded-lg px-[clamp(8px,1vw,14px)] py-[9px] text-[15px] transition-colors hover:bg-mist hover:text-ink ${
    isActive ? "bg-mist font-bold text-primary" : "font-medium text-ink"
  }`;

const HeaderSearch = ({ className = "", style }) => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  // Mirror /browse?q= into the box when the search changes from elsewhere.
  const browseQ = location.pathname === "/browse" ? params.get("q") || "" : null;
  const [q, setQ] = useState(browseQ || "");
  const [syncedQ, setSyncedQ] = useState(browseQ);
  if (browseQ !== null && browseQ !== syncedQ) {
    setSyncedQ(browseQ);
    setQ(browseQ);
  }
  return (
    <form
      role="search"
      className={`flex items-center gap-2 overflow-hidden rounded-full border bg-white pl-5 pr-1 ${className}`}
      style={{ borderColor: "var(--lavender)", height: 48, ...style }}
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/browse?q=${encodeURIComponent(q.trim())}` : "/browse");
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What do you want to learn?"
        aria-label="Search teachers and classes"
        className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-ink outline-none"
      />
      <button type="submit" aria-label="Search" className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-0 bg-primary text-white hover:bg-primary-hover">
        <Icon name="search" size={18} strokeWidth={2} />
      </button>
    </form>
  );
};

const AccountMenu = ({ user, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const links = (ACCOUNT_LINKS[user.role] || []).map(([label, to]) => [label, to.replace(":me", user._id)]);
  const subtitle = [roleLabel(user.role), user.grade].filter(Boolean).join(" · ");
  return (
    <div className="relative flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border-0 bg-transparent py-1 pl-1 pr-2 hover:bg-mist"
      >
        <Avatar name={user.name} size={36} solid />
        <span className="text-[10px] text-ink-2">▾</span>
      </button>
      {open && (
        <div className="popover absolute right-0 z-50 p-2" style={{ top: 52, width: 240 }}>
          <div className="mb-1.5 border-b border-mist p-3">
            <div className="font-bold">{user.name}</div>
            <div className="text-[13px] text-ink-2">{subtitle}</div>
          </div>
          {links.map(([label, to]) => (
            <Link key={label} to={to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-mist hover:text-ink">
              {label}
            </Link>
          ))}
          <button type="button" onClick={onLogout} className="block w-full rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink hover:bg-mist">
            Log out
          </button>
        </div>
      )}
    </div>
  );
};

const AppHeader = () => {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);
  const authed = status === "authenticated" && user;
  const nav = NAV[authed ? user.role : "guest"] || NAV.guest;

  const [drawerPath, setDrawerPath] = useState(location.pathname);
  if (drawerPath !== location.pathname) {
    setDrawerPath(location.pathname);
    setDrawer(false);
  }

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line" style={{ background: "rgba(251,250,253,.94)", backdropFilter: "blur(10px)" }}>
      <div className="shell flex items-center gap-[clamp(14px,2vw,28px)] whitespace-nowrap" style={{ height: 80 }}>
        <button type="button" className="btn btn-ghost -ml-2 p-2 lg:hidden" aria-label="Open menu" onClick={() => setDrawer(true)}>
          <Icon name="menu" />
        </button>
        <Brand to={authed ? "/dashboard" : "/"} />
        <nav className="hidden flex-none gap-1 lg:flex" aria-label="Primary">
          {nav.map(([label, to]) => (
            <NavLink key={to} to={to} end={to === "/dashboard"} className={navClass}>
              {label}
            </NavLink>
          ))}
        </nav>
        <HeaderSearch className="hidden min-w-[52px] max-w-[560px] md:flex" style={{ flex: "3 1 420px" }} />
        <div className="flex-1" />
        <span className="hidden sm:block">
          <LanguagePill />
        </span>
        {authed ? (
          <>
            <NotificationBell />
            <AccountMenu user={user} onLogout={handleLogout} />
          </>
        ) : (
          <>
            <Link to="/login" className="flex-none text-[15px] font-semibold text-ink hover:text-primary">
              Sign in
            </Link>
            <Link to="/register" className="btn btn-primary hidden flex-none sm:inline-flex">
              Join for free
            </Link>
          </>
        )}
      </div>

      {drawer && (
        <div className="modal-backdrop items-stretch justify-start p-0 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="flex h-full w-[300px] max-w-[85vw] flex-col gap-2 overflow-y-auto bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <Brand to={authed ? "/dashboard" : "/"} size={22} />
              <button type="button" className="btn btn-ghost p-2" aria-label="Close menu" onClick={() => setDrawer(false)}>
                <Icon name="x" />
              </button>
            </div>
            <HeaderSearch className="mb-3 flex md:hidden" />
            {nav.map(([label, to]) => (
              <NavLink key={to} to={to} end={to === "/dashboard"} className={navClass}>
                {label}
              </NavLink>
            ))}
            {authed &&
              (ACCOUNT_LINKS[user.role] || []).map(([label, to]) => (
                <NavLink key={label} to={to.replace(":me", user._id)} className={navClass}>
                  {label}
                </NavLink>
              ))}
            <div className="mt-auto flex items-center justify-between border-t border-line pt-4">
              <LanguagePill />
              {authed ? (
                <button type="button" className="btn btn-soft btn-sm" onClick={handleLogout}>
                  Log out
                </button>
              ) : (
                <Link to="/register" className="btn btn-primary btn-sm">
                  Join for free
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
