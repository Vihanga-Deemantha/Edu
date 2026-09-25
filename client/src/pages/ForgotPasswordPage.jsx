import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { forgotPasswordSchema } from "../validation/authSchemas.js";
import AuthLayout, { AuthHeading, SubmitButton } from "../components/auth/AuthLayout.jsx";
import { Field } from "../components/ui/index.jsx";

const ForgotPasswordPage = () => {
  const { forgotPassword } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = async ({ email }) => {
    try {
      await forgotPassword(email);
      navigate("/reset-password", { state: { email } });
    } catch {
      // The backend answers identically whether or not the account exists, so
      // a failure here is a real network/server problem — and the message
      // still mustn't reveal whether the account exists.
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <AuthLayout aside={{ title: "It happens to all of us.", sub: "We'll help you get back into your account in a minute." }}>
      <div className="flex flex-col gap-6">
        <Link to="/login" className="self-start text-sm font-semibold">← Back to sign in</Link>
        <AuthHeading title="Forgot your password?" sub="Enter your email and we'll send a 6-digit code to reset it." />
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" autoComplete="email" placeholder="you@example.com" className={`input ${errors.email ? "err" : ""}`} {...register("email")} />
          </Field>
          <SubmitButton loading={isSubmitting} loadingText="Sending…">Send reset code</SubmitButton>
        </form>
      </div>
      <span className="text-center text-sm text-ink-2">
        Don't have an account? <Link to="/register" className="font-semibold">Register for free</Link>
      </span>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
