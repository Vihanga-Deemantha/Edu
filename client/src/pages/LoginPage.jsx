import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { loginSchema } from "../validation/authSchemas.js";
import AuthLayout, { AuthHeading, PasswordInput, SubmitButton } from "../components/auth/AuthLayout.jsx";
import GoogleSignIn from "../components/auth/GoogleSignIn.jsx";
import { Field } from "../components/ui/index.jsx";
import { apiError, apiErrorCode } from "../lib/format.js";

const LoginPage = () => {
  const { login, status, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (status === "authenticated") navigate(user?.role === "admin" ? "/admin" : from || "/dashboard", { replace: true });
  }, [status, user, from, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async ({ email, password }) => {
    try {
      const loggedIn = await login(email, password);
      navigate(loggedIn?.role === "admin" ? "/admin" : from || "/dashboard");
    } catch (err) {
      if (apiErrorCode(err) === "ACCOUNT_NOT_VERIFIED") {
        toast.error("Please verify your email and phone before signing in.");
        navigate("/verify-otp");
        return;
      }
      toast.error(apiError(err));
    }
  };

  return (
    <AuthLayout
      banner={location.state?.banner}
      aside={{ title: "Welcome back to EduLink.", sub: "Your teachers, messages and upcoming classes are waiting for you." }}
    >
      <div className="flex flex-col gap-6">
        <AuthHeading title="Sign in" sub="Welcome back. Pick up where you left off." />
        <form className="flex flex-col gap-6" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-[18px]">
            <Field label="Email" error={errors.email?.message}>
              <input type="email" autoComplete="email" placeholder="you@example.com" className={`input ${errors.email ? "err" : ""}`} {...register("email")} />
            </Field>
            <Field
              label="Password"
              error={errors.password?.message}
              aside={<Link to="/forgot-password" className="text-[13px] font-semibold">Forgot password?</Link>}
            >
              <PasswordInput autoComplete="current-password" placeholder="Your password" error={errors.password} {...register("password")} />
            </Field>
          </div>
          <SubmitButton loading={isSubmitting} loadingText="Signing in…">Sign in</SubmitButton>
        </form>
        <GoogleSignIn text="signin_with" />
      </div>
      <span className="text-center text-sm text-ink-2">
        Don't have an account? <Link to="/register" className="font-semibold">Register for free</Link>
      </span>
    </AuthLayout>
  );
};

export default LoginPage;
