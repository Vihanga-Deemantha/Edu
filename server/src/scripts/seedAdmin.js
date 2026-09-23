/**
 * seedAdmin.js — one-time script to create/update the admin account.
 *
 * Usage (from the server/ directory):
 *   node src/scripts/seedAdmin.js
 *
 * The admin role is intentionally not exposed through the registration API,
 * so this script is the only way to bootstrap the first admin account.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

// Load .env relative to this file (server/.env)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User.js";

// ── Admin credentials — change these before running ──────────────────────────
const ADMIN = {
  name: "Admin",
  email: "admin@eduhub.lk",
  phone: "+94700000001",   // reserved admin number — change if needed
  password: "Admin@123",   // ← change this!
};
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.");

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  const passwordHash = await bcrypt.hash(ADMIN.password, saltRounds);

  const result = await User.findOneAndUpdate(
    { email: ADMIN.email },
    {
      $set: {
        name: ADMIN.name,
        email: ADMIN.email,
        phone: ADMIN.phone,
        passwordHash,
        role: "admin",
        // NOTE: the User schema has no `verified` field (it was replaced by
        // emailVerified/phoneVerified in the Phase 0 upgrade) — this used to
        // set a field that doesn't exist, silently leaving both flags false,
        // which meant the seeded admin could never pass login's verification
        // gate. Set both explicitly instead.
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        loginDisabled: false,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  console.log("\n✅ Admin account ready:");
  console.log(`   ID    : ${result._id}`);
  console.log(`   Name  : ${result.name}`);
  console.log(`   Email : ${result.email}`);
  console.log(`   Phone : ${result.phone}`);
  console.log(`   Role  : ${result.role}`);
  console.log("\nYou can now log in at /login with these credentials.");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
