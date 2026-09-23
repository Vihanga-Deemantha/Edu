import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { forgotPasswordSchema } from "../validation/authSchemas.js";
import FormError from "../components/FormError.jsx";

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
      toast.success("If that email is registered, a reset code is on its way.");
      navigate("/reset-password", { state: { email } });
    } catch {
      // The backend responds the same way whether or not the account exists,
      // so a request-level failure here is a real network/server problem —
      // still don't reveal account existence in the message.
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card">
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <div className="auth-icon">🔑</div>
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Forgot your password?</h1>
          <p className="text-sm text-muted">
            Enter your email and we&apos;ll send you a 6-digit reset code.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="fp-email" className="form-label">Email</label>
            <input
              id="fp-email"
              type="email"
              className={`form-input ${errors.email ? "input-error" : ""}`}
              placeholder="you@example.com"
              {...register("email")}
            />
            <FormError message={errors.email?.message} />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: "0.5rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="btn-spinner" /> : "Send reset code"}
          </button>
        </form>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          <Link to="/login" className="text-primary font-bold">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
