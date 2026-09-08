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
     * sparse: true means the unique index only applies to documents that
     * actually have this field set (local-only accounts have null here).
     */
    googleId: {
      type: String,
      default: null,
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

    /**
     * select: false — stored hash of the current valid refresh token.
     * Used to detect reuse of rotated/revoked tokens and to invalidate
     * sessions on logout. We store the hash, not the raw token.
     */
    refreshTokenHash: {
      type: String,
      select: false,
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
