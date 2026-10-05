import { useRef, useState } from "react";
import { Avatar, Spinner } from "./ui/index.jsx";
import { MAX_UPLOAD_BYTES, uploadProfilePhoto } from "../lib/upload.js";

/**
 * Circular avatar with change/remove controls. Handles picking a file,
 * validating it, and uploading it directly to Cloudinary — the caller
 * decides what a new photo or a removal actually means (stage it in form
 * state alongside other fields, or save it immediately) via onUploaded/
 * onRemove, since that differs by page (see ProfileEditPage.jsx).
 */
const AvatarUpload = ({ name, src, targetUserId, size = 96, hint, onUploaded, onRemove }) => {
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const pick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That image is larger than 10 MB.");
      return;
    }
    setError("");
    setProgress(0);
    try {
      const res = await uploadProfilePhoto(file, targetUserId, setProgress);
      if (!res.configured) {
        setError(res.message || "Photo uploads aren't set up here yet.");
        return;
      }
      await onUploaded(res.secureUrl);
    } catch (err) {
      const technicalConfigError = /cloud_name|api key|unknown api/i.test(err.message || "");
      setError(technicalConfigError ? "Photo uploads are temporarily unavailable. Please try again later." : err.message || "Upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <Avatar name={name} src={src} size={size} />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{ background: "rgba(22,27,63,.5)" }}>
            <Spinner />
          </div>
        )}
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
        {hint && <span className="text-sm text-ink-2">{hint}</span>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {src ? "Change photo" : "Upload photo"}
          </button>
          {src && (
            <button type="button" className="btn btn-ghost btn-sm hover:text-danger" onClick={() => onRemove?.()} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        {error ? <span className="field-err break-words rounded-lg bg-danger-soft px-3 py-2 leading-snug">{error}</span> : <span className="text-xs text-ink-2">JPG, PNG or WEBP · up to 10 MB</span>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
};

export default AvatarUpload;
