import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { registerSchema } from "../validation/authSchemas.js";
import AuthLayout, { AuthHeading, PasswordInput, PhoneInput, StrengthMeter, SubmitButton } from "../components/auth/AuthLayout.jsx";
import GoogleSignIn from "../components/auth/GoogleSignIn.jsx";
import { Field } from "../components/ui/index.jsx";
import { apiError } from "../lib/format.js";

const ROLE_OPTIONS = [
  { value: "student", label: "Student", desc: "Find teachers and book classes for yourself." },
  { value: "parent", label: "Parent", desc: "Manage your child's learning. You'll add them after signing up." },
  { value: "teacher", label: "Teacher", desc: "Post subject ads, get verified and receive students." },
];

const RoleOption = ({ option, selected, onSelect }) => (
  <button type="button" role="radio" aria-checked={selected} onClick={onSelect} className={`option ${selected ? "on" : ""}`}>
    <span
      className="serif flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[10px] text-[22px] font-bold italic"
      style={{ background: selected ? "var(--primary)" : "var(--mist)", color: selected ? "#fff" : "var(--primary)" }}
    >
      {option.label[0]}
    </span>
    <span className="flex flex-1 flex-col gap-[3px]">
      <span className="serif text-[19px] font-bold">{option.label}</span>
      <span className="text-sm leading-snug text-ink-2">{option.desc}</span>
    </span>
    <span
      className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2"
      style={{ borderColor: selected ? "var(--primary)" : "var(--line)" }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: selected ? "var(--primary)" : "transparent" }} />
    </span>
  </button>
);

const RegisterPage = () => {
  const { register: registerAuth, status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = ROLE_OPTIONS.some((r) => r.value === searchParams.get("role")) ? searchParams.get("role") : "";
  const [step, setStep] = useState(1);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    if (status === "authenticated") navigate("/dashboard", { replace: true });
  }, [status, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { role: initialRole } });
  const role = watch("role");
  const password = watch("password");

  const onSubmit = async (data) => {
    try {
      const payload = { ...data };
      delete payload.confirmPassword;
      await registerAuth(payload);
      toast.success("Account created. Now verify your email and phone.");
      navigate("/verify-otp");
    } catch (err) {
      toast.error(apiError(err, "Registration failed. Please try again."));
    }
  };

  const continueFromRole = () => {
    if (!role) {
      setRoleError("Choose how you will use EduLink");
      return;
    }
    setStep(2);
  };

  return (
    <AuthLayout
      aside={{
        title: "Start learning with a teacher you can trust.",
        sub: "Join students, parents and verified teachers across Sri Lanka. It takes under two minutes.",
      }}
    >
      <div className="flex flex-col gap-6">
        <AuthHeading
          eyebrow={`Step ${step} of 2`}
          title={step === 1 ? "How will you use EduLink?" : "Create your account"}
          sub={step === 1 ? "You can’t change this later, so pick the one that fits." : "We’ll verify your email and phone next."}
        />

        {step === 1 ? (
          <div className="flex flex-col gap-3" role="radiogroup" aria-label="Account type">
            {ROLE_OPTIONS.map((opt) => (
              <RoleOption
                key={opt.value}
                option={opt}
                selected={role === opt.value}
                onSelect={() => {
                  setValue("role", opt.value);
                  setRoleError("");
                }}
              />
            ))}
            {roleError && <span className="field-err">{roleError}</span>}
            <button type="button" className="btn btn-primary btn-block mt-2" onClick={continueFromRole}>
              Continue
            </button>
            <GoogleSignIn text="signup_with" />
          </div>
        ) : (
          <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="flex items-center justify-between rounded-[10px] bg-mist px-4 py-3 text-sm">
              <span>
                Signing up as <b>{role}</b>
              </span>
              <button type="button" onClick={() => setStep(1)} className="border-0 bg-transparent font-semibold text-primary">
                Change
              </button>
            </div>
            <Field label="Full name" error={errors.name?.message}>
              <input autoComplete="name" placeholder="Nimal Silva" className={`input ${errors.name ? "err" : ""}`} {...register("name")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input type="email" autoComplete="email" placeholder="you@example.com" className={`input ${errors.email ? "err" : ""}`} {...register("email")} />
            </Field>
            <Field label="Mobile number" error={errors.phone?.message} hint="We'll text a code to verify it.">
              <PhoneInput autoComplete="tel" error={errors.phone} {...register("phone")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <PasswordInput autoComplete="new-password" placeholder="At least 8 characters" error={errors.password} {...register("password")} />
              <StrengthMeter password={password} />
            </Field>
            <Field label="Confirm password" error={errors.confirmPassword?.message}>
              <input type="password" autoComplete="new-password" placeholder="Re-enter password" className={`input ${errors.confirmPassword ? "err" : ""}`} {...register("confirmPassword")} />
            </Field>
            {errors.role && <span className="field-err">{errors.role.message}</span>}
            <div className="mt-1.5">
              <SubmitButton loading={isSubmitting} loadingText="Creating account…">Create account</SubmitButton>
            </div>
            <span className="text-center text-[13px] leading-normal text-ink-2">
              By creating an account you agree to our Terms and Privacy Policy.
            </span>
          </form>
        )}
      </div>
      <span className="text-center text-sm text-ink-2">
        Already have an account? <Link to="/login" className="font-semibold">Sign in</Link>
      </span>
    </AuthLayout>
  );
};

export default RegisterPage;
