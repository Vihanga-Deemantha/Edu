import mongoose from "mongoose";
import { pointSchema } from "../utils/geoSchema.js";
import { MEDIUM_VALUES, CURRICULUM_VALUES } from "../utils/enums.js";

/**
 * TeacherProfile — the public-facing profile a teacher builds on top of their
 * bare User account: subjects, grades, medium, bio, location, and the
 * simplified verification badge. This is what Phase 6 search results and the
 * public profile page read from — never TeacherVerification directly (see
 * the verificationStatus comment below for why that boundary matters).
 */
const teacherProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    subjects: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one subject is required",
      },
    },

    grades: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one grade is required",
      },
    },

    medium: {
      type: [String],
      enum: MEDIUM_VALUES,
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one medium is required",
      },
    },

    curriculum: {
      type: [String],
      enum: CURRICULUM_VALUES,
      default: [],
    },

    classType: {
      type: [String],
      enum: ["individual", "group", "online", "home_visit"],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "At least one class type is required",
      },
    },

    bio: {
      type: String,
      maxlength: 1000,
      default: "",
    },

    // Phase 19B — optional parallel translations of `bio`, additive only
    // (same reasoning as Listing.description_si/description_ta).
    bio_si: { type: String, maxlength: 1000 },
    bio_ta: { type: String, maxlength: 1000 },

    // Free-text public summary — NOT the same as TeacherVerification's
    // qualificationDocuments (the actual uploaded proof files reviewed by an
    // admin). This is just what's shown on the profile page.
    qualifications: {
      type: [String],
      default: [],
    },

    experienceYears: {
      type: Number,
      min: 0,
      default: 0,
    },

    // A teacher who hasn't set a location has this field genuinely absent —
    // see geoSchema.js's pointSchema comment for why `default: undefined` here too.
    location: {
      type: pointSchema,
      required: false,
      default: undefined,
    },

    photoUrl: { type: String, default: null },
    introVideoUrl: { type: String, default: null },

    /**
     * verificationStatus — a MIRROR of TeacherVerification.verificationTier
     * (Phase 0 upgrade), never a source of truth. It exists so that nothing
     * reading public profile data ever needs a query path anywhere near
     * TeacherVerification, which holds NIC numbers and police-clearance
     * scans. Read-only from the client's perspective — stripped from every
     * incoming request in profiles.service.js regardless of what validation
     * lets through, and only ever written here (on first profile creation,
     * picking up whatever tier already exists) or by Phase 14's admin
     * approve/reject flow via syncTeacherVerificationStatus.
     */
    verificationStatus: {
      type: String,
      enum: ["none", "id_verified", "fully_verified"],
      default: "none",
    },

    // Denormalized — written only by Phase 11 (reviews), never here.
    avgRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

teacherProfileSchema.index({ location: "2dsphere" });
// NOT a compound { subjects: 1, grades: 1 } index — MongoDB rejects a
// compound index across two array fields at write time ("cannot index
// parallel arrays"), since it would need a cartesian product of index
// entries. Two single-field indexes still let Mongo satisfy an AND query on
// both via index intersection.
teacherProfileSchema.index({ subjects: 1 });
teacherProfileSchema.index({ grades: 1 });

const TeacherProfile = mongoose.model("TeacherProfile", teacherProfileSchema);

export default TeacherProfile;
