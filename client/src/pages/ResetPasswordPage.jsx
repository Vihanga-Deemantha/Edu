import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { resetPasswordSchema } from "../validation/authSchemas.js";
import AuthLayout, { AuthHeading, PasswordInput, StrengthMeter, SubmitButton } from "../components/auth/AuthLayout.jsx";
import { Field } from "../components/ui/index.jsx";
import { apiError } from "../lib/format.js";

const ResetPasswordPage = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const knownEmail = location.state?.email || "";
  const [email, setEmail] = useState(knownEmail);
  const [emailError, setEmailError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema) });

  const onSubmit = async ({ code, newPassword }) => {
    if (!email.trim()) {
      setEmailError("Enter the email you requested the code for");
      return;
    }
    try {
      await resetPassword(email.trim(), code, newPassword);
      navigate("/login", { state: { banner: "Password updated. Please sign in." } });
    } catch (err) {
      toast.error(apiError(err, "Could not reset password. Please try again."));
    }
  };

  return (
    <AuthLayout aside={{ title: "Choose a new password.", sub: "Use at least 8 characters. A mix of letters and numbers is stronger." }}>
      <div className="flex flex-col gap-5">
        <AuthHeading
          title="Reset your password"
          sub={
            knownEmail ? (
              <>We emailed a code to <b className="text-ink">{knownEmail}</b>. Enter it below and choose a new password.</>
            ) : (
              "Enter the code from your email and choose a new password."
            )
          }
        />
        <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
          {!knownEmail && (
            <Field label="Email" error={emailError}>
              <input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }} placeholder="you@example.com" className={`input ${emailError ? "err" : ""}`} />
            </Field>
          )}
          <Field label="6-digit code" error={errors.code?.message}>
            <input
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="••••••"
              className={`input serif text-center ${errors.code ? "err" : ""}`}
              style={{ height: 56, fontSize: 26, letterSpacing: ".5em", borderRadius: 10 }}
              {...register("code")}
            />
          </Field>
          <Field label="New password" error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" error={errors.newPassword} {...register("newPassword")} />
            <StrengthMeter password={watch("newPassword")} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword?.message}>
            <input type="password" autoComplete="new-password" placeholder="Re-enter new password" className={`input ${errors.confirmPassword ? "err" : ""}`} {...register("confirmPassword")} />
          </Field>
          <SubmitButton loading={isSubmitting} loadingText="Updating…">Reset password</SubmitButton>
        </form>
      </div>
      <span className="text-center text-sm text-ink-2">
        Didn't get a code? <Link to="/forgot-password" className="font-semibold">Request again</Link>
      </span>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
