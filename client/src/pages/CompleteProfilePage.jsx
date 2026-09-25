import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { phoneField } from "../validation/authSchemas.js";
import AuthLayout, { AuthHeading, PhoneInput, SubmitButton } from "../components/auth/AuthLayout.jsx";
import { Avatar, Field } from "../components/ui/index.jsx";
import { apiError } from "../lib/format.js";

const schema = z.object({
  role: z.enum(["teacher", "student", "parent"], { message: "Please select your role" }),
  phone: phoneField,
});

const ROLES = [
  { value: "student", label: "Student" },
  { value: "parent", label: "Parent" },
  { value: "teacher", label: "Teacher" },
];

const CompleteProfilePage = () => {
  const { status, completeProfile, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
    if (status === "unauthenticated") navigate("/login", { replace: true });
  }, [status, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { role: "" } });
  const role = watch("role");

  const onSubmit = async ({ role: r, phone }) => {
    try {
      await completeProfile(r, phone);
      toast.success("Saved. Now verify your phone number.");
      navigate("/verify-otp");
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  return (
    <AuthLayout aside={{ title: "Nearly there.", sub: "Tell us a little about yourself so we can show you the right teachers." }}>
      <form className="flex flex-col gap-[22px]" onSubmit={handleSubmit(onSubmit)} noValidate>
        {user?.name && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
            <Avatar name={user.name} size={40} solid />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{user.name}</div>
              <div className="truncate text-[13px] text-ink-2">{user.email} · via Google</div>
            </div>
            <span className="text-xs font-semibold text-primary">✓ Email verified</span>
          </div>
        )}
        <AuthHeading title="Complete your profile" sub="Almost there. Tell us who you are and add your mobile number." />
        <div className="flex flex-col gap-2">
          <span className="field-label">I am a…</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
            {ROLES.map((r) => {
              const on = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setValue("role", r.value, { shouldValidate: true })}
                  className="serif rounded-[10px] border-[1.5px] px-2 py-3.5 text-center text-[17px] font-bold hover:border-primary"
                  style={{ borderColor: on ? "var(--primary)" : "var(--line)", background: on ? "var(--mist)" : "#fff" }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {errors.role && <span className="field-err">{errors.role.message}</span>}
        </div>
        <Field label="Mobile number" error={errors.phone?.message}>
          <PhoneInput autoComplete="tel" error={errors.phone} {...register("phone")} />
        </Field>
        <SubmitButton loading={isSubmitting} loadingText="Saving…">Continue</SubmitButton>
      </form>
      <span className="text-center text-sm text-ink-2">
        Already have an account? <Link to="/login" className="font-semibold">Sign in</Link>
      </span>
    </AuthLayout>
  );
};

export default CompleteProfilePage;
