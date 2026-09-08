import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";

const RESEND_COOLDOWN = 60;

const OtpChannelCard = ({ channel, label, icon, userId, isVerified, onVerified }) => {
  const { verifyOtp, resendOtp } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await verifyOtp(userId, channel, code);
      if (data.fullyVerified || data[`${channel === "email" ? "emailVerified" : "phoneVerified"}`]) {
        onVerified?.(channel);
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Incorrect code. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = useCallback(async () => {
    setResendLoading(true);
    try {
      await resendOtp(userId, channel);
      toast.success(`New code sent to your ${channel}.`);
      setCooldown(RESEND_COOLDOWN);
      setCode("");
      setError(null);
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Could not resend. Please wait a moment.";
      toast.error(msg);
    } finally {
      setResendLoading(false);
    }
  }, [userId, channel, resendOtp]);

  if (isVerified) {
    return (
      <div style={{ backgroundColor: "var(--success-light)", border: "2px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-lg)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem", transition: "background-color 0.2s" }}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{icon} {label}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: "700", color: "var(--success)" }}>
            ✓ Verified
          </span>
        </div>
        <p className="text-sm" style={{ color: "rgba(16, 185, 129, 0.8)" }}>
          This channel has been verified successfully.
        </p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "var(--white)", border: "2px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem", transition: "border-color 0.2s" }}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>{icon} {label}</span>
        <span className="text-xs text-muted">
          Pending verification
        </span>
      </div>

      <form onSubmit={handleVerify} className="flex flex-col gap-3">
        <div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setError(null);
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
            }}
            className={`form-input text-center font-bold ${error ? "input-error" : ""}`}
            style={{ fontSize: "1.5rem", letterSpacing: "0.3em", padding: "0.75rem" }}
            placeholder="— — — — — —"
            autoComplete="one-time-code"
            disabled={loading}
          />
          {error && <p className="form-error">{error}</p>}
        </div>

        <button
          type="submit"
          className="btn btn-secondary btn-full"
          disabled={loading || code.length !== 6}
        >
          {loading ? <span className="btn-spinner" /> : `Verify ${label}`}
        </button>

        <div className="text-center" style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
          {cooldown > 0 ? (
            <span>Resend available in {cooldown}s</span>
          ) : (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "0.25rem 0.5rem", fontSize: "0.8125rem" }}
              onClick={handleResend}
              disabled={resendLoading}
            >
              {resendLoading ? "Sending…" : "Resend code"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

const VerifyOtpPage = () => {
  const { status, pendingUserId, user } = useAuth();
  const navigate = useNavigate();

  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
  }, [status, navigate]);

  const googleEmailAlreadyVerified = status === "otp_pending" && user?.emailVerified;
  const resolvedUserId = pendingUserId || user?._id || user?.id;

  if (!resolvedUserId && status !== "loading" && status !== "otp_pending") {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <p className="text-muted" style={{ marginBottom: "1rem" }}>No pending verification found.</p>
          <Link to="/register" className="btn btn-primary">
            Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card" style={{ maxWidth: "30rem" }}>
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <div className="auth-icon">
            ✉️
          </div>
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Verify your account</h1>
          <p className="text-sm text-muted">
            Enter the 6-digit codes sent to your email and phone. Both must be verified before you can log in.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <OtpChannelCard
            channel="email"
            label="Email"
            icon="📧"
            userId={resolvedUserId}
            isVerified={emailVerified || googleEmailAlreadyVerified}
            onVerified={() => setEmailVerified(true)}
          />

          <OtpChannelCard
            channel="phone"
            label="Phone"
            icon="📱"
            userId={resolvedUserId}
            isVerified={phoneVerified}
            onVerified={() => setPhoneVerified(true)}
          />
        </div>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          Wrong account?{" "}
          <Link to="/login" className="text-primary font-bold" onMouseEnter={(e) => e.target.style.color = "var(--primary-dark)"} onMouseLeave={(e) => e.target.style.color = "var(--primary)"}>Sign in with a different account</Link>
        </p>
      </div>
    </div>
  );
};

export default VerifyOtpPage;
