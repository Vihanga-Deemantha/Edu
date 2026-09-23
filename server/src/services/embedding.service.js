import { pipeline } from "@huggingface/transformers";

/**
 * Phase 16 — text embeddings, generated locally (no external API, no
 * per-call cost, nothing leaves this process). multilingual-e5-small:
 * small (384-dim, ~120MB), genuinely multilingual — verified directly
 * against this project's actual mediums (English/Sinhala/Tamil): a Sinhala
 * sentence embeds closer to its English translation than to an unrelated
 * English sentence, which is the property semantic search over a
 * multilingual marketplace actually needs.
 *
 * E5 models are trained with an explicit "query: " / "passage: " prefix
 * convention distinguishing search queries from the documents being
 * searched — using the right one measurably improves retrieval quality for
 * this model family specifically; it's not a stylistic choice.
 */
const MODEL_NAME = "Xenova/multilingual-e5-small";
export const EMBEDDING_DIMENSIONS = 384;

// Loaded once, lazily, and reused — loading the model takes real time
// (downloads/reads weights from cache), so every call after the first
// reuses this same instance rather than reloading per request. server.js
// warms this up at startup so the first real request isn't the one that
// pays the load cost.
let extractorPromise = null;
const getExtractor = () => {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return extractorPromise;
};

const embed = async (prefixedText) => {
  const extractor = await getExtractor();
  const output = await extractor(prefixedText, { pooling: "mean", normalize: true });
  return Array.from(output.data);
};

/** For document text — teacher bios, listing descriptions — being indexed for later search. */
export const embedPassage = (text) => embed(`passage: ${text}`);

/** For a user's free-text search query. */
export const embedQuery = (text) => embed(`query: ${text}`);

/** Call once at server startup so the first real request doesn't pay the model-load cost. */
export const warmUpEmbeddingModel = () => getExtractor();
