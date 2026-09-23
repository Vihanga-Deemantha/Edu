/**
 * createVectorSearchIndex.js — one-time script to create the Atlas Vector
 * Search index Phase 16's semantic search reads from.
 *
 * Usage (from the server/ directory):
 *   node src/scripts/createVectorSearchIndex.js
 *
 * Requires MONGO_URI to point at a real MongoDB Atlas cluster — Vector
 * Search isn't available on a local/self-hosted MongoDB (that includes
 * MongoMemoryServer, which is why the test suite never hits this path;
 * search.service.js's in-memory cosine-similarity fallback covers that
 * case instead). Available on every Atlas tier, including the free M0.
 *
 * Safe to run more than once — skips if an index with this name already
 * exists.
 */

import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, "../../.env") });

import mongoose from "mongoose";
import { EMBEDDING_DIMENSIONS } from "../services/embedding.service.js";

// Must match search.service.js's VECTOR_INDEX_NAME exactly.
const INDEX_NAME = "listing_embedding_index";

async function run() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  const collection = mongoose.connection.collection("listings");

  const existing = await collection
    .listSearchIndexes()
    .toArray()
    .catch(() => []);
  if (existing.some((idx) => idx.name === INDEX_NAME)) {
    console.log(`Index "${INDEX_NAME}" already exists — nothing to do.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Creating vector search index "${INDEX_NAME}" on listings.embedding…`);
  await collection.createSearchIndex({
    name: INDEX_NAME,
    type: "vectorSearch",
    definition: {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: EMBEDDING_DIMENSIONS,
          similarity: "cosine",
        },
      ],
    },
  });

  console.log("\nIndex creation requested. Atlas builds vector search indexes asynchronously —");
  console.log('check the Atlas UI\'s "Search" tab, or re-run this script, to confirm it reaches');
  console.log("READY (usually a minute or two). Nothing breaks in the meantime: semantic search");
  console.log("automatically falls back to an in-memory scan until the index is ready.");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Failed:", err.message);
  console.error("\nThis needs a real MongoDB Atlas cluster — Vector Search isn't available on a");
  console.error("local/self-hosted MongoDB deployment.");
  process.exit(1);
});
