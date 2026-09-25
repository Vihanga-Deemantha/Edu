import { verificationApi } from "../api/endpoints.js";

/**
 * Direct-to-Cloudinary upload of a verification document using the signed
 * params from GET /api/verification/teacher/upload-signature — the file
 * never passes through our server. Resolves to the asset's public_id, which
 * is what TeacherVerification stores (see server upload.service.js).
 * Resolves `{ configured: false }` when the environment has no Cloudinary.
 */
export const uploadVerificationDocument = async (file, onProgress) => {
  const sig = await verificationApi.uploadSignature();
  if (!sig.configured) return { configured: false, message: sig.message };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", sig.timestamp);
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);
  form.append("type", sig.type);

  const body = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else reject(new Error(json?.error?.message || "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });

  return { configured: true, publicId: body.public_id, bytes: body.bytes, format: body.format };
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
