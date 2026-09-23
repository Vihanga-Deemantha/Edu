import mongoose from "mongoose";
import { pointSchema } from "../utils/geoSchema.js";
import { MEDIUM_VALUES } from "../utils/enums.js";

/**
 * StudentProfile — grade/subject/location info for a student or parent-managed
 * child. For a child account, userId is the CHILD's User._id, but this
 * document is only ever written through the parent's authenticated session
 * (enforced in profiles.service.js) — the child never authenticates directly
 * (Phase 0 decision).
 *
 * No 2dsphere index yet — student profiles aren't searched anywhere before
 * Phase 6+; only TeacherProfile is geo-indexed for now.
 */
const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    gradeOrLevel: {
      type: String,
      default: null,
    },

    subjectsInterested: {
      type: [String],
      default: [],
    },

    medium: {
      type: [String],
      enum: MEDIUM_VALUES,
      default: [],
    },

    location: {
      type: pointSchema,
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

const StudentProfile = mongoose.model("StudentProfile", studentProfileSchema);

export default StudentProfile;
