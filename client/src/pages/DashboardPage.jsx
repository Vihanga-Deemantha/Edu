import useAuth from "../hooks/useAuth.js";

const DashboardPage = () => {
  const { user } = useAuth();

  return (
    <div className="container" style={{ padding: "3rem 1.5rem" }}>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6" style={{ marginBottom: "3rem", borderBottom: "1px solid var(--border)", paddingBottom: "2rem" }}>
        <div className="flex items-center gap-6">
          <div style={{ width: "4rem", height: "4rem", borderRadius: "1rem", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: "700", color: "var(--primary)", boxShadow: "0 4px 10px rgba(79, 125, 243, 0.1)", flexShrink: 0 }}>
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold" style={{ marginBottom: "0.25rem", color: "var(--text-main)" }}>
              Welcome back, {user?.name}
            </h1>
            <p className="text-muted">
              Here is what&apos;s happening with your account today.
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button className="btn btn-secondary">Settings</button>
          <button className="btn btn-primary">New Message</button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:grid-cols-2 lg:grid-cols-4 gap-4" style={{ marginBottom: "3rem", display: "grid" }}>
        <div className="friendly-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Account Role</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--text-main)", textTransform: "capitalize" }}>{user?.role}</div>
        </div>
        <div className="friendly-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Status</div>
          <div style={{ fontSize: "1.25rem", fontWeight: "700", color: "var(--success)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", backgroundColor: "var(--success)" }}></span> Active
          </div>
        </div>
        <div className="friendly-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Email</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={user?.email}>{user?.email}</div>
        </div>
        <div className="friendly-card" style={{ padding: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-secondary)", marginBottom: "0.5rem" }}>Phone</div>
          <div style={{ fontSize: "1rem", fontWeight: "600", color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.phone}</div>
        </div>
      </div>

      <div className="friendly-card" style={{ padding: "2rem", minHeight: "300px" }}>
        <h2 className="text-xl font-bold" style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", color: "var(--text-main)" }}>Recent Activity</h2>
        <div className="text-center text-muted" style={{ padding: "3rem 0" }}>
          No recent activity to show.
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
