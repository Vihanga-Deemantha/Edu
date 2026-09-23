import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { resetPasswordSchema } from "../validation/authSchemas.js";
import FormError from "../components/FormError.jsx";

const ResetPasswordPage = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ code, newPassword }) => {
    if (!email) {
      toast.error("Enter the email you requested the reset code for.");
      return;
    }
    try {
      await resetPassword(email, code, newPassword);
      toast.success("Password updated. Please sign in.");
      navigate("/login");
    } catch (err) {
      const message =
        err.response?.data?.error?.message || "Could not reset password. Please try again.";
      toast.error(message);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card">
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <div className="auth-icon">🔑</div>
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Reset your password</h1>
          <p className="text-sm text-muted">
            Enter the 6-digit code we emailed you and choose a new password.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="rp-email" className="form-label">Email</label>
            <input
              id="rp-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="rp-code" className="form-label">6-digit code</label>
            <input
              id="rp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className={`form-input text-center font-bold ${errors.code ? "input-error" : ""}`}
              style={{ letterSpacing: "0.3em" }}
              placeholder="——————"
              {...register("code")}
            />
            <FormError message={errors.code?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="rp-password" className="form-label">New password</label>
            <input
              id="rp-password"
              type="password"
              className={`form-input ${errors.newPassword ? "input-error" : ""}`}
              placeholder="Min. 8 characters"
              {...register("newPassword")}
            />
            <FormError message={errors.newPassword?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="rp-confirm" className="form-label">Confirm new password</label>
            <input
              id="rp-confirm"
              type="password"
              className={`form-input ${errors.confirmPassword ? "input-error" : ""}`}
              placeholder="Re-enter new password"
              {...register("confirmPassword")}
            />
            <FormError message={errors.confirmPassword?.message} />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: "0.5rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="btn-spinner" /> : "Reset password"}
          </button>
        </form>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          <Link to="/forgot-password" className="text-primary font-bold">Didn&apos;t get a code? Request again</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
