import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      // Sri Lanka: +94XXXXXXXXX or 0XXXXXXXXX (10 digits total after prefix)
      match: [
        /^(\+94|0)[0-9]{9}$/,
        "Phone must be a valid Sri Lankan number (+94XXXXXXXXX or 0XXXXXXXXX)",
      ],
    },

    /**
     * select: false — passwordHash is NEVER returned in any query by default.
     * Must explicitly use .select('+passwordHash') when you need it (login).
     */
    passwordHash: {
      type: String,
      select: false,
    },

    role: {
      type: String,
      enum: ["teacher", "student", "parent", "admin"],
      required: [true, "Role is required"],
    },

    // Optional — only meaningful for child (student) accounts
    grade: {
      type: String,
      default: null,
    },

    /**
     * Verification flags — split per channel so email and phone can be
     * verified at different times (important for Google Sign-In where email
     * is pre-verified but phone is not).
     *
     * POLICY: both emailVerified AND phoneVerified must be true before login
     * is allowed, for every role except children (who never log in directly).
     */
    emailVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    /**
     * Auth provider — 'local' for email+password, 'google' for Google Sign-In.
     * An account can have both (local user links their Google account).
     */
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },

    /**
     * Google-specific — the 'sub' claim from the Google ID token.
     *
     * Deliberately NO `default` here. `sparse: true` on the index below only
     * excludes documents where this field is entirely ABSENT — a document
     * that has the field explicitly set to `null` still counts as "present"
     * for the sparse index's uniqueness check. A `default: null` was tried
     * first and meant every local-auth user got an explicit `googleId: null`
     * on creation, so the *second* local user ever registered would collide
     * with the first on this index and fail with a nonsensical "Googleid is
     * already in use" error. Leaving the field undefined for local users
     * makes it genuinely absent, which is what sparse actually needs.
     */
    googleId: {
      type: String,
    },

    /**
     * profileComplete — false only for a brand-new Google Sign-In account that
     * hasn't picked a role or entered a real phone number yet. Every
     * local-registered account is complete from the moment it's created.
     *
     * This is the single source of truth for "does this Google user still
     * need the complete-profile step" — deliberately NOT inferred from
     * whether `role` happens to be set (a placeholder role is still assigned
     * at creation so the schema's `required` constraint is satisfied) and NOT
     * inferred from the shape of the `phone` value. Both of those were tried
     * first and both broke: a real Sri Lankan mobile number can start with
     * the same prefix a placeholder phone used, so string-sniffing the phone
     * is not a safe signal. This explicit flag is.
     */
    profileComplete: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * PARENT-CHILD MODEL (Phase 0 decision):
     *
     * When a parent creates a child account via POST /api/auth/register-child,
     * the child (student) gets:
     *   - passwordHash: null
     *   - loginDisabled: true
     *   - parentId: <parent's _id>
     *
     * This means the child NEVER logs in independently. All child-account
     * actions in later phases go through the parent's authenticated session.
     *
     * Why? Because parents are legally responsible for minors, and we don't
     * want children to have their own session/credentials they can misuse.
     * The parent's access token encapsulates authority over the child's profile.
     */
    loginDisabled: {
      type: Boolean,
      default: false,
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Only relevant for role === 'parent'.
     * Stores the IDs of child accounts this parent manages.
     */
    linkedChildIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    /**
     * Child account safety (Phase 0 upgrade, Part D):
     * When a parent creates a child account they must attest guardianship.
     * We store the timestamp as an audit trail.
     */
    attestedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// Indexes — email and phone are already indexed via `unique: true`
// Compound index on role for fast role-based filtering in later phases
userSchema.index({ role: 1 });
// Sparse unique index on googleId so local-only users (googleId: null) don't clash
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

export default User;
