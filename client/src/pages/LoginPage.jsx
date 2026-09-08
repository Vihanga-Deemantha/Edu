import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import useAuth from "../hooks/useAuth.js";
import { loginSchema } from "../validation/authSchemas.js";
import FormError from "../components/FormError.jsx";

const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_SIGNIN_ENABLED === "true";

const LoginPage = () => {
  const { login, googleLogin, status } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
  }, [status, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async ({ email, password }) => {
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const message = err.response?.data?.error?.message || "Something went wrong. Please try again.";

      if (code === "ACCOUNT_NOT_VERIFIED") {
        toast.error("Please verify your email and phone before signing in.");
        navigate("/verify-otp");
        return;
      }

      toast.error(message);
    }
  };

  const onGoogleSuccess = async (credentialResponse) => {
    try {
      const data = await googleLogin(credentialResponse.credential);
      if (data?.profileIncomplete) {
        navigate("/complete-profile");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      const msg = err.response?.data?.error?.message || "Google sign-in failed. Please try again.";
      toast.error(msg);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card">
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <img src="/edulink-friendly-logo.png" alt="EduLink Logo" style={{ width: "3.5rem", height: "3.5rem", margin: "0 auto 1.25rem", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(79, 125, 243, 0.15)" }} />
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Welcome back</h1>
          <p className="text-sm text-muted">Sign in to continue to EduLink</p>
        </div>

        {GOOGLE_ENABLED && (
          <>
            <div className="flex justify-center" style={{ marginBottom: "1.25rem" }}>
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => toast.error("Google sign-in failed. Please try again.")}
                useOneTap
                size="large"
                shape="rectangular"
                theme="outline"
                text="signin_with"
              />
            </div>
            <div className="divider">or</div>
          </>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="login-email" className="form-label">Email</label>
            <input
              id="login-email"
              type="email"
              className={`form-input ${errors.email ? "input-error" : ""}`}
              placeholder="you@example.com"
              {...register("email")}
            />
            <FormError message={errors.email?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="login-password" className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className={`form-input ${errors.password ? "input-error" : ""}`}
              placeholder="Your password"
              {...register("password")}
            />
            <FormError message={errors.password?.message} />
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: "0.5rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="btn-spinner" /> : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary font-bold" onMouseEnter={(e) => e.target.style.color = "var(--primary-dark)"} onMouseLeave={(e) => e.target.style.color = "var(--primary)"}>Create one</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
