import { useState } from "react";
import { Link } from "react-router-dom";
import { Modal, Spinner } from "./ui/index.jsx";
import useAuth from "../hooks/useAuth.js";
import { interestsApi } from "../api/endpoints.js";
import { apiError, firstName, formatPrice } from "../lib/format.js";

const MAX = 1000;

/**
 * Express interest in a listing (spec §8.1). A parent picks which linked
 * child it's for first (the backend requires targetUserId for a parent);
 * a student sends for themselves; a teacher responding to a wanted ad
 * sends for themselves too.
 */
const ExpressInterestModal = ({ open, onClose, listing: fixedListing, listings, ownerName, onSent }) => {
  const { user } = useAuth();
  const children = user?.role === "parent" ? user.linkedChildIds || [] : [];
  const [childId, setChildId] = useState(children.length === 1 ? children[0]._id : "");
  // From a listing page the listing is fixed; from a teacher profile the
  // viewer picks which of the teacher's classes this is for.
  const [listingId, setListingId] = useState(fixedListing?._id || listings?.[0]?._id || "");
  const listing = fixedListing || listings?.find((l) => l._id === listingId) || listings?.[0];
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const who = firstName(ownerName) || "They";

  const starters =
    user?.role === "teacher"
      ? ["I teach this subject", "I have weekend slots", "I can teach online"]
      : ["I'm preparing for my exams", "Looking for weekend classes", "Could we start with a trial class?"];

  const send = async () => {
    if (!listing) {
      setError("Choose a class first.");
      return;
    }
    if (user?.role === "parent" && !childId) {
      setError("Choose which child this is for.");
      return;
    }
    if (message.trim().length < 10) {
      setError(`Write at least a sentence so ${who} knows what you need.`);
      return;
    }
    setSending(true);
    setError("");
    try {
      const { interestRequest } = await interestsApi.create({
        listingId: listing._id,
        message: message.trim(),
        ...(user?.role === "parent" ? { targetUserId: childId } : {}),
      });
      setDone(true);
      onSent?.(interestRequest);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSending(false);
    }
  };

  const close = () => {
    onClose();
    if (done) {
      setDone(false);
      setMessage("");
    }
  };

  return (
    <Modal open={open} onClose={close} width={520}>
      <div className="flex flex-col gap-5 p-[30px]">
        {done ? (
          <div className="flex flex-col items-center gap-3.5 py-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-[28px] text-white">✓</div>
            <span className="serif text-[30px]">Sent!</span>
            <span className="max-w-[360px] text-[15px] leading-normal text-ink-2">
              You'll be notified when {who} responds. If they accept, you can chat and book a trial class.
            </span>
            <button type="button" className="btn btn-primary mt-1.5" onClick={close}>Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="serif text-[28px] font-bold leading-tight">Express interest</span>
                <span className="text-sm text-ink-2">
                  {fixedListing
                    ? `${fixedListing.subject} · ${fixedListing.grade}${ownerName ? ` with ${ownerName}` : ""}`
                    : `to ${ownerName || "this teacher"}`}
                </span>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-0 bg-mist text-sm">✕</button>
            </div>

            {!fixedListing && listings?.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="field-label">Which class?</span>
                {listings.map((l) => (
                  <button
                    key={l._id}
                    type="button"
                    aria-pressed={listing?._id === l._id}
                    onClick={() => setListingId(l._id)}
                    className={`option justify-between px-3.5 py-3 text-sm ${listing?._id === l._id ? "on" : ""}`}
                  >
                    <span className="font-semibold">{l.subject} · {l.grade}</span>
                    <span className="whitespace-nowrap text-ink-2">{formatPrice(l.price)}</span>
                  </button>
                ))}
              </div>
            )}

            {user?.role === "parent" && (
              <div className="flex flex-col gap-2">
                <span className="field-label">Who is this for?</span>
                {children.length === 0 ? (
                  <span className="rounded-[10px] bg-mist px-4 py-3 text-sm">
                    Add your child first — <Link to="/children" className="font-semibold">add a child</Link>.
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {children.map((c) => (
                      <button key={c._id} type="button" aria-pressed={childId === c._id} onClick={() => { setChildId(c._id); setError(""); }} className={`chip ${childId === c._id ? "on" : ""}`}>
                        {c.name}{c.grade ? ` · ${c.grade}` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="field">
              <span className="field-label">Your message</span>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => { setMessage(e.target.value.slice(0, MAX)); setError(""); }}
                placeholder={user?.role === "teacher" ? "Introduce yourself: what you teach, your experience, and when you're free." : "Introduce yourself: your grade, what you need help with, and when you're free."}
                className={`textarea ${error ? "err" : ""}`}
              />
              <span className="flex justify-between text-[13px]">
                <span className="text-danger">{error}</span>
                <span className="text-ink-2">{message.length} / {MAX}</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {starters.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => setMessage((m) => `${m ? `${m.trim()} ` : ""}${s}.`)}>{s}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2.5">
              <button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={sending || (user?.role === "parent" && children.length === 0)}>
                {sending && <Spinner dark={false} />}
                {sending ? "Sending…" : "Send interest"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ExpressInterestModal;
