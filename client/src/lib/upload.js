import { verificationApi, profilesApi } from "../api/endpoints.js";

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

/**
 * Direct-to-Cloudinary upload of a PUBLIC profile photo, using the signed
 * params from GET /api/profiles/photo/upload-signature — separate from
 * uploadVerificationDocument above, which signs for private "authenticated"
 * delivery instead. Resolves to the asset's secure_url, directly usable as
 * photoUrl with no further signing step. `targetUserId` scopes the upload to
 * a linked child's folder when a parent is uploading on the child's behalf;
 * omit it to upload for the caller's own account.
 */
export const uploadProfilePhoto = async (file, targetUserId, onProgress) => {
  const sig = await profilesApi.photoUploadSignature(targetUserId);
  if (!sig.configured) return { configured: false, message: sig.message };

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", sig.timestamp);
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  const body = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`);
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

  return { configured: true, secureUrl: body.secure_url, publicId: body.public_id };
};
