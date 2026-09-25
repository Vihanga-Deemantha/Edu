import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import AuthLayout, { AuthHeading } from "../components/auth/AuthLayout.jsx";
import { Spinner } from "../components/ui/index.jsx";
import { apiError } from "../lib/format.js";

const RESEND_COOLDOWN = 60;

/** Six display boxes over one transparent input (keeps paste + autofill working). */
const CodeBoxes = ({ code, onChange, error, disabled, label }) => (
  <div className="relative grid grid-cols-6 gap-2">
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className="serif flex h-14 items-center justify-center rounded-[10px] border-[1.5px] bg-white text-[26px]"
        style={{ borderColor: error ? "var(--danger)" : i === code.length ? "var(--primary)" : "var(--lavender)" }}
      >
        {code[i] || ""}
      </div>
    ))}
    <input
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label={`${label} verification code`}
      value={code}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      className="absolute inset-0 w-full cursor-text opacity-0"
    />
  </div>
);

const ChannelCard = ({ channel, label, target, userId, verified, onVerified }) => {
  const { verifyOtp, resendOtp } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const verify = async () => {
    if (code.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      // A wrong/expired code throws; reaching here means this channel is verified.
      // Once both are, AuthContext flips to "authenticated" and the effect below redirects.
      await verifyOtp(userId, channel, code);
      onVerified(channel);
    } catch (err) {
      setError(apiError(err, "Incorrect code. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const resend = useCallback(async () => {
    try {
      await resendOtp(userId, channel);
      toast.success(`New code sent to your ${channel}.`);
      setCooldown(RESEND_COOLDOWN);
      setCode("");
      setError("");
    } catch (err) {
      toast.error(apiError(err, "Could not resend. Please wait a moment."));
    }
  }, [userId, channel, resendOtp]);

  return (
    <div
      className="flex flex-col gap-3.5 rounded-[14px] border-[1.5px] p-5 transition-colors"
      style={{ borderColor: verified ? "var(--primary)" : "var(--line)", background: verified ? "var(--mist)" : "#fff" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="serif text-lg font-bold">{label}</span>
          {target && <span className="truncate text-[13px] text-ink-2">{target}</span>}
        </div>
        <span className={`status ${verified ? "status-solid" : "status-soft"}`}>{verified ? "✓ Verified" : "Pending"}</span>
      </div>
      {!verified && (
        <>
          <CodeBoxes code={code} onChange={(v) => { setCode(v); setError(""); }} error={error} disabled={loading} label={label} />
          {error && <span className="field-err">{error}</span>}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold"
              style={{ color: cooldown ? "var(--ink-2)" : "var(--primary)" }}
            >
              {cooldown ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button type="button" onClick={verify} disabled={loading || code.length !== 6} className="btn btn-primary btn-sm">
              {loading && <Spinner dark={false} />} Verify
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const VerifyOtpPage = () => {
  const { status, pendingUserId, user } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState({ email: false, phone: false });

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
  }, [status, navigate]);

  // A Google account arrives here with its email already verified; only the phone is left.
  const emailPreVerified = status === "otp_pending" && user?.emailVerified;
  const userId = pendingUserId || user?._id || user?.id;
  const aside = { title: "One last step.", sub: "Verifying your email and phone keeps EduLink safe for everyone, especially children." };

  if (!userId && status !== "loading" && status !== "otp_pending") {
    return (
      <AuthLayout aside={aside}>
        <AuthHeading title="Nothing to verify" sub="We couldn't find an account waiting for verification in this session." />
        <Link to="/login" className="btn btn-primary btn-block">Sign in</Link>
        <Link to="/register" className="text-center text-sm font-semibold">Create an account</Link>
      </AuthLayout>
    );
  }

  const markVerified = (channel) => setVerified((v) => ({ ...v, [channel]: true }));

  return (
    <AuthLayout aside={aside}>
      <div className="flex flex-col gap-6">
        <AuthHeading title="Verify your account" sub="Enter the 6-digit codes we sent. Both need to be verified before you can sign in." />
        <ChannelCard channel="email" label="Email" target={user?.email} userId={userId} verified={verified.email || emailPreVerified} onVerified={markVerified} />
        <ChannelCard channel="phone" label="Phone" target={user?.phone} userId={userId} verified={verified.phone} onVerified={markVerified} />
        <span className="text-center text-sm text-ink-2">
          Wrong account? <Link to="/login" className="font-semibold">Sign in with a different one</Link>
        </span>
      </div>
    </AuthLayout>
  );
};

export default VerifyOtpPage;
