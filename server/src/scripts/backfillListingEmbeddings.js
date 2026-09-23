/**
 * backfillListingEmbeddings.js — generates Phase 16 embeddings for any
 * Listing that doesn't have one yet: created before this phase shipped, or
 * a previous attempt that failed and was silently swallowed (see
 * listings.service.js's generateAndStoreEmbedding — best-effort, non-fatal
 * by design, so a transient failure there leaves a gap this script closes).
 *
 * Usage (from the server/ directory):
 *   node src/scripts/backfillListingEmbeddings.js
 *
 * Safe to run repeatedly — only touches listings missing an embedding.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import Listing from "../models/Listing.js";
import { embeddingSourceText } from "../modules/listings/listings.service.js";
import { embedPassage, warmUpEmbeddingModel } from "../services/embedding.service.js";

/**
 * Testable apart from the CLI wrapper below, same shape as
 * migrateLegacyUserFields.js's runMigration.
 */
export const runBackfill = async () => {
  const listings = await Listing.find({ embedding: { $exists: false } });

  let succeeded = 0;
  let failed = 0;
  for (const listing of listings) {
    try {
      listing.embedding = await embedPassage(await embeddingSourceText(listing));
      await listing.save();
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`  Failed for listing ${listing._id}: ${err.message}`);
    }
  }

  return { total: listings.length, succeeded, failed };
};

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`;

if (isMainModule) {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  console.log("Loading embedding model (first run downloads it — this can take a minute)…");
  await warmUpEmbeddingModel();
  console.log("Model ready.\n");

  const { total, succeeded, failed } = await runBackfill();
  console.log(`\nFound ${total} listing(s) with no embedding — ${succeeded} succeeded, ${failed} failed.`);

  await mongoose.disconnect();
  process.exit(0);
}
