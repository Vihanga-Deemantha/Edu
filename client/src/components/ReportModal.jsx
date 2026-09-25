import { useState } from "react";
import toast from "react-hot-toast";
import { Modal, Spinner } from "./ui/index.jsx";
import { reportsApi } from "../api/endpoints.js";
import { apiError } from "../lib/format.js";

const REASONS = {
  listing: ["Misleading information", "Asks to pay outside EduLink", "Inappropriate content", "Spam or duplicate"],
  user: ["Inappropriate messages", "Asked to move off EduLink", "Suspected fake account", "Safety concern"],
  review: ["Not a real student", "Offensive language", "Wrong teacher"],
};

/** Report a listing, user or review into the admin moderation queue. */
const ReportModal = ({ open, onClose, targetType, targetId, targetLabel }) => {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = [reason, details.trim()].filter(Boolean).join(" — ");
    if (!text) {
      setError("Choose a reason or describe the problem.");
      return;
    }
    setSending(true);
    try {
      await reportsApi.create({ targetType, targetId, reason: text.slice(0, 1000) });
      toast.success("Report sent. Our team reviews reports within 24 hours.");
      setReason("");
      setDetails("");
      onClose();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Report ${targetType}`}>
      <div className="flex flex-col gap-4 p-6">
        {targetLabel && <span className="text-sm text-ink-2">{targetLabel}</span>}
        <div className="flex flex-wrap gap-2">
          {REASONS[targetType].map((r) => (
            <button key={r} type="button" aria-pressed={reason === r} className={`chip ${reason === r ? "on" : ""}`} onClick={() => { setReason(reason === r ? "" : r); setError(""); }}>
              {r}
            </button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Details (optional)</span>
          <textarea rows={3} className={`textarea ${error ? "err" : ""}`} value={details} maxLength={900} onChange={(e) => { setDetails(e.target.value); setError(""); }} placeholder="What happened? Anything that helps us review it." />
          {error && <span className="field-err">{error}</span>}
        </label>
        <div className="flex justify-end gap-2.5">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={sending}>
            {sending && <Spinner dark={false} />} Send report
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ReportModal;
