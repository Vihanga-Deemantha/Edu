import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import FormError from "../components/FormError.jsx";

const schema = z.object({
  role: z.enum(["teacher", "student", "parent"], {
    errorMap: () => ({ message: "Please select your role" }),
  }),
  phone: z
    .string()
    .trim()
    .regex(/^(\+94|0)[0-9]{9}$/, "Phone must be a valid Sri Lankan number (+94XXXXXXXXX or 0XXXXXXXXX)"),
});

const ROLES = [
  { value: "teacher", label: "Teacher" },
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
];

const CompleteProfilePage = () => {
  const { status, completeProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
    if (status === "unauthenticated") navigate("/login", { replace: true });
  }, [status, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ role, phone }) => {
    try {
      await completeProfile(role, phone);
      toast.success("Profile updated! Please verify your phone number.");
      navigate("/verify-otp");
    } catch (err) {
      const message =
        err.response?.data?.error?.message || "Something went wrong. Please try again.";
      toast.error(message);
    }
  };

  return (
    <div className="auth-container">
      <div className="bg-blob" />

      <div className="auth-card">
        <div className="text-center" style={{ marginBottom: "2rem" }}>
          <div className="auth-icon" style={{ backgroundColor: "var(--highlight)", color: "var(--white)", boxShadow: "0 4px 12px rgba(244, 184, 216, 0.4)" }}>
            👤
          </div>
          <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Complete your profile</h1>
          <p className="text-sm text-muted">
            Almost there — just tell us your role and phone number.
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="cp-role" className="form-label">I am a…</label>
            <select id="cp-role" className={`form-select ${errors.role ? "input-error" : ""}`} {...register("role")}>
              <option value="">Select your role</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <FormError message={errors.role?.message} />
          </div>

          <div className="form-group" style={{ marginBottom: "0" }}>
            <label htmlFor="cp-phone" className="form-label">Phone number</label>
            <input
              id="cp-phone"
              type="tel"
              className={`form-input ${errors.phone ? "input-error" : ""}`}
              placeholder="+94771234567 or 0771234567"
              {...register("phone")}
            />
            <FormError message={errors.phone?.message} />
          </div>

          <button
            id="complete-profile-submit"
            type="submit"
            className="btn btn-accent btn-full"
            style={{ marginTop: "0.5rem" }}
            disabled={isSubmitting}
          >
            {isSubmitting ? <span className="btn-spinner" /> : "Continue"}
          </button>
        </form>

        <p className="text-center text-sm text-muted" style={{ marginTop: "2rem" }}>
          <Link to="/login" className="text-primary font-bold" onMouseEnter={(e) => e.target.style.color = "var(--primary-dark)"} onMouseLeave={(e) => e.target.style.color = "var(--primary)"}>← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
