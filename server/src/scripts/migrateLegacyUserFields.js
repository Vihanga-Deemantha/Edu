/**
 * migrateLegacyUserFields.js — one-time backfill for two schema changes.
 * Safe to run multiple times (idempotent); a no-op against a database that
 * was never on the older schema versions this addresses.
 *
 * Usage (from the server/ directory): node src/scripts/migrateLegacyUserFields.js
 *
 * ── 1. profileComplete ──────────────────────────────────────────────────────
 * `User.profileComplete` defaults to `true` on the schema. Mongoose applies
 * schema defaults on document HYDRATION, not just construction — so any
 * document saved before this field existed (no stored value at all) reads as
 * `true` the moment it's loaded, even if it's a Google-sign-in account that
 * never finished the role/phone completion step. That silently and
 * permanently locks such an account out of ever finishing onboarding
 * (completeProfile's guard is `if (user.profileComplete) throw 409`).
 *
 * There's no reliable field that proves a stored document predates
 * `profileComplete` (Mongoose defaults it in memory before you can inspect
 * what's "really" stored), so this migration goes straight to the driver
 * layer to check for the field's physical absence in MongoDB, bypassing
 * Mongoose's schema-default hydration entirely.
 *
 * Backfill rule:
 *   - authProvider: 'local'  → profileComplete: true  (local registration
 *     always collects a full profile at signup; there's no partial state)
 *   - authProvider: 'google' → profileComplete: true only if phoneVerified
 *     is already true (the only way that becomes true for a Google account
 *     is by finishing completeProfile's phone-OTP step) — otherwise false,
 *     which is the safe default: worst case, a genuinely-complete old
 *     account gets prompted through complete-profile once more, harmless,
 *     versus the alternative of leaving a genuinely-incomplete account
 *     permanently locked out.
 *
 * ── 2. googleId ──────────────────────────────────────────────────────────────
 * `googleId` used to default to `null`, and the sparse unique index on it
 * still indexes an explicit null (sparse only excludes a field that's
 * entirely ABSENT). Any local-auth document saved under the old schema still
 * has `googleId: null` stored explicitly. This $unsets it so the field is
 * genuinely absent, matching what the current schema (no default) produces
 * for every new local user.
 */

import mongoose from "mongoose";

/**
 * Runs the backfill against whatever Mongoose connection is already open
 * (the caller connects/disconnects — this makes the migration importable
 * and directly testable, not just runnable as a standalone script).
 * Returns counts for each step.
 */
export const runMigration = async () => {
  const users = mongoose.connection.collection("users");

  const local = await users.updateMany(
    { authProvider: "local", profileComplete: { $exists: false } },
    { $set: { profileComplete: true } }
  );

  const googleComplete = await users.updateMany(
    { authProvider: "google", profileComplete: { $exists: false }, phoneVerified: true },
    { $set: { profileComplete: true } }
  );

  const googleIncomplete = await users.updateMany(
    { authProvider: "google", profileComplete: { $exists: false }, phoneVerified: { $ne: true } },
    { $set: { profileComplete: false } }
  );

  const googleId = await users.updateMany(
    { authProvider: "local", googleId: null },
    { $unset: { googleId: "" } }
  );

  return {
    profileCompleteLocal: local.modifiedCount,
    profileCompleteGoogleComplete: googleComplete.modifiedCount,
    profileCompleteGoogleIncomplete: googleIncomplete.modifiedCount,
    googleIdUnset: googleId.modifiedCount,
  };
};

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;

if (isMainModule) {
  const { fileURLToPath } = await import("url");
  const { dirname, resolve } = await import("path");
  const dotenv = (await import("dotenv")).default;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  dotenv.config({ path: resolve(__dirname, "../../.env") });

  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  const counts = await runMigration();
  console.log(`profileComplete backfill (local): ${counts.profileCompleteLocal} document(s) updated.`);
  console.log(`profileComplete backfill (google, verified): ${counts.profileCompleteGoogleComplete} document(s) updated.`);
  console.log(`profileComplete backfill (google, unverified): ${counts.profileCompleteGoogleIncomplete} document(s) updated.`);
  console.log(`googleId backfill: ${counts.googleIdUnset} document(s) updated.`);
  console.log("\nMigration complete.");

  await mongoose.disconnect();
  process.exit(0);
}
