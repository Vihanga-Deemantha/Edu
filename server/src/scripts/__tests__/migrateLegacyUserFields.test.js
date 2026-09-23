import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import User from "../../models/User.js";
import { runMigration } from "../migrateLegacyUserFields.js";

/**
 * Inserts a document directly via the raw driver, bypassing Mongoose schema
 * defaults entirely — this is the only way to simulate a "legacy" document
 * that was actually saved before profileComplete existed, since creating it
 * through the Mongoose model would apply today's defaults and defeat the
 * whole point of the test.
 */
const insertRawUser = (overrides) =>
  mongoose.connection.collection("users").insertOne({
    name: "Legacy User",
    email: `legacy.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`,
    phone: `+94${Math.floor(100000000 + Math.random() * 899999999)}`,
    role: "student",
    emailVerified: true,
    phoneVerified: false,
    authProvider: "local",
    isActive: true,
    loginDisabled: false,
    linkedChildIds: [],
    ...overrides,
    // profileComplete intentionally omitted unless passed in overrides —
    // that's the whole point of "legacy" (pre-field) documents.
  });

describe("migrateLegacyUserFields", () => {
  it("backfills profileComplete:true for a local user missing the field", async () => {
    const { insertedId } = await insertRawUser({ authProvider: "local" });

    await runMigration();

    const user = await User.findById(insertedId);
    expect(user.profileComplete).toBe(true);
  });

  it("backfills profileComplete:true for a Google user who already verified their phone", async () => {
    const { insertedId } = await insertRawUser({
      authProvider: "google",
      googleId: "google-sub-123",
      phoneVerified: true,
    });

    await runMigration();

    const user = await User.findById(insertedId);
    expect(user.profileComplete).toBe(true);
  });

  it("backfills profileComplete:false for a Google user who never verified their phone (safe default, not locked out)", async () => {
    const { insertedId } = await insertRawUser({
      authProvider: "google",
      googleId: "google-sub-456",
      phoneVerified: false,
    });

    await runMigration();

    const user = await User.findById(insertedId);
    expect(user.profileComplete).toBe(false);
  });

  it("unsets a legacy explicit googleId:null on a local account", async () => {
    const { insertedId } = await insertRawUser({ authProvider: "local", googleId: null });

    await runMigration();

    const raw = await mongoose.connection.collection("users").findOne({ _id: insertedId });
    expect("googleId" in raw).toBe(false);
  });

  it("does not touch a document that already has profileComplete set", async () => {
    const { insertedId } = await insertRawUser({ authProvider: "local", profileComplete: false });

    await runMigration();

    const user = await User.findById(insertedId);
    expect(user.profileComplete).toBe(false);
  });

  it("is idempotent — running it twice produces the same result", async () => {
    const { insertedId } = await insertRawUser({ authProvider: "local" });

    await runMigration();
    await runMigration();

    const user = await User.findById(insertedId);
    expect(user.profileComplete).toBe(true);
  });
});
