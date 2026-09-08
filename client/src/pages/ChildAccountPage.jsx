import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import useAuth from "../hooks/useAuth.js";
import { childSchema } from "../validation/authSchemas.js";
import FormError from "../components/FormError.jsx";

const ChildAccountPage = () => {
  const { user, registerChild } = useAuth();
  const [childrenList, setChildrenList] = useState(user?.children || []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(childSchema) });

  const onSubmit = async (data) => {
    try {
      const newChild = await registerChild(data);
      setChildrenList([...childrenList, newChild]);
      toast.success("Child account created successfully!");
      reset();
    } catch (err) {
      const message =
        err.response?.data?.error?.message ||
        "Failed to create child account.";
      toast.error(message);
    }
  };

  return (
    <div className="container" style={{ maxWidth: "64rem", padding: "3rem 1.5rem" }}>
      <div style={{ marginBottom: "2.5rem" }}>
        <h1 className="text-3xl font-bold" style={{ marginBottom: "0.5rem", color: "var(--text-main)" }}>Child Accounts</h1>
        <p className="text-muted">
          Manage your children&apos;s accounts. As a parent, you control their access and communication.
        </p>
      </div>

      <div className="flex flex-col lg-flex-row lg-grid-cols-2 gap-8" style={{ display: "grid" }}>
        <div className="friendly-card" style={{ height: "fit-content" }}>
          <h2 className="text-xl font-bold" style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", color: "var(--text-main)" }}>Add a Child</h2>
          
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group" style={{ marginBottom: "0" }}>
              <label htmlFor="child-name" className="form-label">Child&apos;s Name</label>
              <input
                id="child-name"
                className={`form-input ${errors.name ? "input-error" : ""}`}
                placeholder="Name"
                {...register("name")}
              />
              <FormError message={errors.name?.message} />
            </div>

            <div className="form-group" style={{ marginBottom: "0" }}>
              <label htmlFor="child-grade" className="form-label">Grade</label>
              <select
                id="child-grade"
                className={`form-select ${errors.grade ? "input-error" : ""}`}
                {...register("grade")}
              >
                <option value="">Select Grade</option>
                {[...Array(13)].map((_, i) => (
                  <option key={i} value={`Grade ${i + 1}`}>
                    Grade {i + 1}
                  </option>
                ))}
              </select>
              <FormError message={errors.grade?.message} />
            </div>

            <div className="form-group" style={{ marginBottom: "0" }}>
              <div className="flex items-center justify-between">
                <label htmlFor="child-email" className="form-label">Email</label>
                <span style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>Optional</span>
              </div>
              <input
                id="child-email"
                type="email"
                className={`form-input ${errors.email ? "input-error" : ""}`}
                placeholder="Optional"
                {...register("email")}
              />
              <FormError message={errors.email?.message} />
            </div>

            <div className="form-group" style={{ marginBottom: "0" }}>
              <div className="flex items-center justify-between">
                <label htmlFor="child-phone" className="form-label">Phone</label>
                <span style={{ fontSize: "0.625rem", textTransform: "uppercase", fontWeight: "700", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>Optional</span>
              </div>
              <input
                id="child-phone"
                type="tel"
                className={`form-input ${errors.phone ? "input-error" : ""}`}
                placeholder="Optional"
                {...register("phone")}
              />
              <FormError message={errors.phone?.message} />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              style={{ marginTop: "0.5rem" }}
              disabled={isSubmitting}
            >
              {isSubmitting ? <span className="btn-spinner" /> : "Create Account"}
            </button>
          </form>
        </div>

        <div className="friendly-card" style={{ height: "fit-content" }}>
          <h2 className="text-xl font-bold" style={{ marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border)", color: "var(--text-main)" }}>Your Children</h2>
          
          {childrenList.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: "2.5rem 0", border: "2px dashed var(--border)", borderRadius: "var(--radius-lg)" }}>
              You haven&apos;t added any children yet.
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {childrenList.map((child) => (
                <li key={child._id} className="flex items-center gap-4" style={{ padding: "1rem", backgroundColor: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", transition: "border-color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--primary)"} onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}>
                  <div style={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "var(--primary)", flexShrink: 0 }}>
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <span style={{ fontWeight: "700", color: "var(--text-main)" }}>{child.name}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{child.grade}</span>
                  </div>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "0.375rem 0.75rem" }}>Manage</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChildAccountPage;
