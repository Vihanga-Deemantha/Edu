import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { GoogleLogin } from "@react-oauth/google";
import useAuth from "../hooks/useAuth.js";
import { registerSchema } from "../validation/authSchemas.js";
import FormError from "../components/FormError.jsx";

const GOOGLE_ENABLED = import.meta.env.VITE_GOOGLE_SIGNIN_ENABLED === "true";

const ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

const RegisterPage = () => {
  const { register: registerAuth, googleLogin, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
  }, [status, navigate]);

  const defaultRole = ROLES.some(r => r.value === searchParams.get("role")) 
    ? searchParams.get("role") 
    : "";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ 
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole }
  });

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      delete payload.confirmPassword;
      await registerAuth(payload);
      toast.success("Account created! Please verify your contact details.");
      navigate("/verify-otp");
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        "Registration failed. Please try again.";
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
      const msg = err.response?.data?.error?.message || "Google sign-up failed. Please try again.";
      toast.error(msg);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card">
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <img src="/edulink-friendly-logo.png" alt="EduLink Logo" style={{ width: "3.5rem", height: "3.5rem", margin: "0 auto 1.25rem", borderRadius: "1rem", boxShadow: "0 4px 12px rgba(79, 125, 243, 0.15)" }} />
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Create Account</h1>
          <p className="text-sm text-muted">Join EduLink to get started</p>
        </div>

        {GOOGLE_ENABLED && (
          <>
            <div className="flex justify-center" style={{ marginBottom: "1.25rem" }}>
              <GoogleLogin
                onSuccess={onGoogleSuccess}
                onError={() => toast.error("Google sign-up failed. Please try again.")}
                useOneTap
                size="large"
                shape="rectangular"
                theme="outline"
                text="signup_with"
              />
            </div>
            <div className="divider">or sign up with email</div>
          </>
        )}

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-name" className="form-label">Full Name</label>
            <input
              id="reg-name"
              className={`form-input ${errors.name ? "input-error" : ""}`}
              placeholder="John Silva"
              {...register("name")}
            />
            <FormError message={errors.name?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-email" className="form-label">Email</label>
            <input
              id="reg-email"
              type="email"
              className={`form-input ${errors.email ? "input-error" : ""}`}
              placeholder="you@example.com"
              {...register("email")}
            />
            <FormError message={errors.email?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-phone" className="form-label">Phone</label>
            <input
              id="reg-phone"
              type="tel"
              className={`form-input ${errors.phone ? "input-error" : ""}`}
              placeholder="+94771234567 or 0771234567"
              {...register("phone")}
            />
            <FormError message={errors.phone?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-role" className="form-label">Role</label>
            <select
              id="reg-role"
              className={`form-select ${errors.role ? "input-error" : ""}`}
              {...register("role")}
            >
              <option value="">Select your role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <FormError message={errors.role?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-password" className="form-label">Password</label>
            <input
              id="reg-password"
              type="password"
              className={`form-input ${errors.password ? "input-error" : ""}`}
              placeholder="Min. 8 characters"
              {...register("password")}
            />
            <FormError message={errors.password?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="reg-confirm" className="form-label">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              className={`form-input ${errors.confirmPassword ? "input-error" : ""}`}
              placeholder="Re-enter password"
              {...register("confirmPassword")}
            />
            <FormError message={errors.confirmPassword?.message} />
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: "0.5rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="btn-spinner" /> : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-bold" onMouseEnter={(e) => e.target.style.color = "var(--primary-dark)"} onMouseLeave={(e) => e.target.style.color = "var(--primary)"}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
