/**
 * Cloudinary stores the original upload, but pages should never download that
 * full-resolution file for a small avatar. Public Cloudinary image URLs allow
 * transformations to be inserted immediately after `/image/upload/`.
 * Non-Cloudinary URLs are returned untouched.
 */
export const cloudinaryImage = (src, { width, height = width, crop = "fill" } = {}) => {
  if (!src || !width || !src.includes("res.cloudinary.com") || !src.includes("/image/upload/")) return src;

  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const transform = ["f_auto", "q_auto:good", `c_${crop}`, "g_auto", `w_${safeWidth}`, `h_${safeHeight}`].join(",");

  return src.replace("/image/upload/", `/image/upload/${transform}/`);
};
