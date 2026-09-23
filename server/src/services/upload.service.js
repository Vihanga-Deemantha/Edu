import { v2 as cloudinary } from "cloudinary";

/**
 * Upload service — signed, authenticated-delivery document storage via
 * Cloudinary, for the sensitive files TeacherVerification stores
 * (NIC scans, selfie-with-ID, police clearance).
 *
 * WHY signed uploads instead of proxying files through our own server:
 * the frontend uploads directly to Cloudinary using a signature this backend
 * generates, so a multi-megabyte scan never has to pass through our Node
 * process. WHY "authenticated" delivery type: these documents must never be
 * reachable on a guessable public URL — every view goes through
 * getSignedViewUrl(), which expires in minutes, and every request for one is
 * permission-checked by the caller (see verification.controller.js).
 *
 * Falls back to a clearly-labeled "not configured" response when
 * CLOUDINARY_* env vars are absent, matching the dev-fallback pattern
 * already used by email.service.js/sms.service.js — so a dev environment
 * without real credentials doesn't crash, it just can't actually store files yet.
 */

let configured = false;

const ensureConfigured = () => {
  if (configured) return true;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return false;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  configured = true;
  return true;
};

/**
 * Returns signed parameters the frontend uses to upload a file directly to
 * Cloudinary. The frontend must send these back unchanged as form fields
 * alongside the file itself (Cloudinary's own unsigned/signed upload API).
 *
 * @param {object} options
 * @param {string} options.folder - scopes where the file lands, e.g. `teacher-verification/<userId>`
 * @returns {{configured:false, message:string}|{configured:true, timestamp:number, signature:string, apiKey:string, cloudName:string, folder:string, type:string}}
 */
export const getSignedUploadParams = ({ folder }) => {
  if (!ensureConfigured()) {
    return {
      configured: false,
      message:
        "Document uploads are not configured in this environment (missing CLOUDINARY_* env vars in .env).",
    };
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder, type: "authenticated" };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    configured: true,
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    type: "authenticated",
  };
};

/**
 * Generates a short-lived signed URL to view a previously-uploaded private
 * document. `publicId` is what Cloudinary returned at upload time — this is
 * what should actually be stored in TeacherVerification's `...Url` fields
 * despite the field names (a public_id, not a browsable URL — there is no
 * public URL for an authenticated-delivery asset).
 */
export const getSignedViewUrl = (publicId, resourceType = "image") => {
  if (!ensureConfigured()) {
    throw new Error("Document storage is not configured in this environment.");
  }
  return cloudinary.url(publicId, {
    type: "authenticated",
    resource_type: resourceType,
    sign_url: true,
    secure: true,
  });
};

export const isUploadConfigured = () => ensureConfigured();
