import { Link, useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.js";

const Brand = () => (
  <div className="flex items-center gap-2">
    <img src="/edulink-friendly-logo.png" alt="EduLink Logo" style={{ height: "32px", width: "32px", borderRadius: "8px" }} />
    <Link to="/" style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: "700", color: "var(--text-main)", letterSpacing: "-0.025em" }}>
      Edu<span style={{ color: "var(--primary)" }}>Link</span>
    </Link>
  </div>
);

const Navbar = () => {
  const { user, status, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLanding = location.pathname === "/";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const navStyle = {
    position: "sticky",
    top: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 1.5rem",
    height: "4.5rem",
    backgroundColor: "rgba(250, 251, 255, 0.8)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid var(--border)",
  };

  if (status === "loading") {
    return (
      <nav style={navStyle}>
        <Brand />
      </nav>
    );
  }

  if (status === "unauthenticated" || status === "otp_pending" || status === "profile_incomplete") {
    return (
      <nav style={navStyle}>
        <Brand />
        <div className="flex items-center gap-4">
          <Link to="/login" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>
            Sign in
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            {isLanding ? "Get started" : "Register"}
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav style={navStyle}>
      <Brand />
      <div className="flex items-center gap-6">
        <Link to="/dashboard" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>
          Dashboard
        </Link>
        {user?.role === "parent" && (
          <Link to="/children" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)", transition: "color 0.2s" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>
            Child Accounts
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3 ml-auto">
        <span style={{ display: "inline-flex", alignItems: "center", padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.625rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", backgroundColor: "var(--secondary)", color: "var(--primary)" }}>
          {user?.role}
        </span>
        <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-main)", display: "inline-block" }} className="hidden sm:inline-block">{user?.name}</span>
        <button className="btn btn-ghost btn-sm ml-2" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
