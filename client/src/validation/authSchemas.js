import { z } from "zod";

// Sri Lanka phone: +94XXXXXXXXX or 0XXXXXXXXX — mirrors backend regex exactly
const sriLankaPhone = /^(\+94|0)[0-9]{9}$/;

export const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    phone: z
      .string()
      .min(1, "Phone is required")
      .regex(
        sriLankaPhone,
        "Enter a valid Sri Lankan phone (+94XXXXXXXXX or 0XXXXXXXXX)"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    role: z.enum(["teacher", "student", "parent"], {
      errorMap: () => ({ message: "Select a valid role" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const childSchema = z.object({
  name: z.string().min(1, "Child name is required"),
  grade: z.string().optional(),
});
