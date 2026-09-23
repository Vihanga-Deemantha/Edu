import mongoose from "mongoose";
import { pointSchema } from "../utils/geoSchema.js";
import { MEDIUM_VALUES, CURRICULUM_VALUES } from "../utils/enums.js";

/**
 * Listing — the actual marketplace inventory. A `teacher_ad` (a teacher
 * advertising a subject they teach) or a `student_ad` (a student/parent
 * advertising a subject they need a teacher for).
 *
 * VISIBILITY RULE (enforced in listings.service.js, not here — see
 * isVisibleToRequester / visibilityQueryFilter): a `teacher_ad` is visible to
 * anyone, including guests; a `student_ad` is visible only to authenticated
 * teachers (and the ad's own owner/parent/an admin). A non-teacher requesting
 * a `student_ad` by ID gets 404, never 403 — the ad's existence isn't
 * confirmed to someone who isn't allowed to see it at all.
 *
 * `location` is denormalized from the owner's profile at creation time
 * (copied in listings.service.js, not read live from TeacherProfile/
 * StudentProfile on every request) — so a teacher moving house later doesn't
 * retroactively relocate an old, already-posted ad.
 */
const listingSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["teacher_ad", "student_ad"],
      required: true,
      immutable: true, // never editable after creation — changing it would break the visibility rule's invariants
    },

    // For a student_ad created by a parent on behalf of a child, this is the
    // CHILD's User._id (matches the StudentProfile/register-child pattern) —
    // never the parent's. Management (PATCH/DELETE) is still authorized for
    // the parent via the same linked-child check used everywhere else.
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    subject: { type: String, required: true, trim: true },
    grade: { type: String, required: true, trim: true },
    medium: {
      type: String,
      enum: MEDIUM_VALUES,
      required: true,
    },
    curriculum: {
      type: String,
      enum: CURRICULUM_VALUES,
      default: null,
    },

    // No field-level defaults on any child here (see geoSchema.js's comment
    // on the same class of bug) — a listing with no stated price should have
    // `price` genuinely absent, not a partial `{ currency: "LKR" }` object.
    // The default currency is applied in listings.service.js instead, only
    // when a price is actually provided.
    price: {
      amount: { type: Number, min: 0 },
      currency: { type: String },
      unit: { type: String, enum: ["hour", "month"] },
    },

    schedule: { type: [String], default: [] },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    // Phase 19B — optional parallel translations of `description`, not a
    // replacement for it. `description` itself is unchanged: whatever
    // language the teacher/student originally wrote it in stays the
    // required, always-present field; these are purely additive, so no
    // existing listing or API caller needs retrofitting. Same length bounds
    // as `description` when present, since a translation shorter than a
    // real sentence isn't meaningfully useful either.
    description_si: { type: String, trim: true, minlength: 10, maxlength: 2000 },
    description_ta: { type: String, trim: true, minlength: 10, maxlength: 2000 },

    location: {
      type: pointSchema,
      required: false,
      default: undefined,
    },

    status: {
      type: String,
      enum: ["active", "closed", "flagged"],
      default: "active",
    },

    /**
     * Phase 16 — a 384-dim embedding of this listing's searchable text
     * (subject/grade/description, plus the owning teacher's bio for a
     * teacher_ad), generated locally in listings.service.js on create/
     * update (services/embedding.service.js). select: false, same as
     * passwordHash — a large float array with no reason to ever appear in
     * a normal API response. No regular Mongoose index here: the actual
     * vector index is Atlas-Search-managed, created separately (see
     * scripts/createVectorSearchIndex.js), not something Mongoose's
     * schema-level .index() can express.
     *
     * default: undefined, not omitted — an Array-type schema path gets an
     * implicit default: [] otherwise (the same class of bug fixed twice
     * already this project, in geoSchema.js's pointSchema). An implicit []
     * would make every listing "have" an embedding by search.service.js's
     * embedding: { $exists: true } fallback filter, defeating the whole
     * point of that check — genuinely absent must stay genuinely absent.
     */
    embedding: { type: [Number], select: false, default: undefined },
  },
  { timestamps: true }
);

listingSchema.index({ location: "2dsphere" });
// Valid compound index — type/status/subject/grade are all single-value
// fields on this schema (unlike TeacherProfile's subjects/grades arrays),
// so this doesn't hit the "parallel arrays" restriction.
listingSchema.index({ type: 1, status: 1, subject: 1, grade: 1 });
listingSchema.index({ ownerId: 1 });

const Listing = mongoose.model("Listing", listingSchema);

export default Listing;
