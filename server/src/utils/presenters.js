import User from "../models/User.js";
import TeacherProfile from "../models/TeacherProfile.js";

/**
 * Read-side presenters — batch-resolve the display fields (names, ratings,
 * verification tier) that list endpoints need to render anything meaningful,
 * so the frontend never has to follow up with one request per row. Every
 * function here is additive: it returns plain objects carrying the original
 * document's fields unchanged, plus new summary fields alongside them.
 *
 * Nothing here ever exposes contact details (email/phone) — those stay gated
 * behind interests.service.js's accepted-only contact reveal. A child-linked
 * account is summarized by first name only, with isChild set so the UI can
 * label it, never with anything that identifies the child further.
 */

const toPlain = (doc) => (doc && typeof doc.toObject === "function" ? doc.toObject() : doc);

const uniqueIds = (ids) => [...new Set(ids.filter(Boolean).map(String))];

const firstName = (name = "") => name.trim().split(/\s+/)[0] || name;

/** Map<userId, { _id, name, role, isChild, grade, parentId, parentName }> */
export const summarizeUsers = async (ids) => {
  const idList = uniqueIds(ids);
  if (idList.length === 0) return new Map();

  const users = await User.find({ _id: { $in: idList } }).select("name role grade parentId createdAt");
  const parentIds = uniqueIds(users.map((u) => u.parentId));
  const parents = parentIds.length
    ? await User.find({ _id: { $in: parentIds } }).select("name")
    : [];
  const parentNameById = new Map(parents.map((p) => [String(p._id), p.name]));

  return new Map(
    users.map((u) => {
      const isChild = Boolean(u.parentId);
      return [
        String(u._id),
        {
          _id: u._id,
          name: isChild ? firstName(u.name) : u.name,
          role: u.role,
          isChild,
          grade: u.grade || null,
          parentId: u.parentId || null,
          parentName: isChild ? parentNameById.get(String(u.parentId)) || null : null,
          memberSince: u.createdAt,
        },
      ];
    })
  );
};

/** Map<userId, { photoUrl, avgRating, reviewCount, verificationStatus, subjects, experienceYears }> */
export const summarizeTeachers = async (ids) => {
  const idList = uniqueIds(ids);
  if (idList.length === 0) return new Map();

  const profiles = await TeacherProfile.find({ userId: { $in: idList } }).select(
    "userId photoUrl avgRating reviewCount verificationStatus subjects experienceYears classType"
  );
  return new Map(
    profiles.map((p) => [
      String(p.userId),
      {
        photoUrl: p.photoUrl || null,
        avgRating: p.avgRating || 0,
        reviewCount: p.reviewCount || 0,
        verificationStatus: p.verificationStatus || "none",
        subjects: p.subjects || [],
        experienceYears: p.experienceYears || 0,
        classType: p.classType || [],
      },
    ])
  );
};

/**
 * Attaches `owner` to each listing — a teacher summary (name, photo, rating,
 * verification tier) for a teacher_ad, a minimal student summary for a
 * student_ad. Works on both Mongoose documents and plain aggregate results.
 */
export const attachListingOwners = async (listings) => {
  const plain = listings.map(toPlain);
  const ownerIds = plain.map((l) => l.ownerId);
  const teacherOwnerIds = plain.filter((l) => l.type === "teacher_ad").map((l) => l.ownerId);

  const [users, teachers] = await Promise.all([summarizeUsers(ownerIds), summarizeTeachers(teacherOwnerIds)]);

  return plain.map((listing) => {
    const user = users.get(String(listing.ownerId));
    const teacher = teachers.get(String(listing.ownerId));
    const owner = user
      ? {
          _id: user._id,
          name: user.name,
          role: user.role,
          isChild: user.isChild,
          grade: user.grade,
          ...(listing.type === "teacher_ad"
            ? {
                photoUrl: teacher?.photoUrl ?? null,
                avgRating: teacher?.avgRating ?? 0,
                reviewCount: teacher?.reviewCount ?? 0,
                verificationStatus: teacher?.verificationStatus ?? "none",
              }
            : {}),
        }
      : null;
    return { ...listing, owner };
  });
};

/** Single-listing convenience wrapper around attachListingOwners. */
export const presentListing = async (listing) => {
  const [presented] = await attachListingOwners([listing]);
  return presented;
};

export { toPlain };
