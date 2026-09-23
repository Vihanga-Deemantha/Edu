import Listing from "../../models/Listing.js";
import { buildListingStructuredFilter } from "../listings/listings.service.js";
import { embedQuery } from "../../services/embedding.service.js";

const VECTOR_INDEX_NAME = "listing_embedding_index";
const CANDIDATE_POOL_SIZE = 200; // same "cheap enough at this scale" reasoning as Phase 8/12

/**
 * Manual cosine similarity — the fallback path below runs this in JS over
 * a bounded candidate pool, the same class of thing Phase 8's content
 * scoring already does, rather than needing Atlas's own vector index.
 */
const cosineSimilarity = (a, b) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * $vectorSearch retrieves a broad candidate set by similarity alone, THEN
 * a plain $match applies the full structured filter — deliberately not
 * passed as $vectorSearch's own `filter` option, which needs Atlas
 * Search's own query syntax (equals/range/compound), not regular MongoDB
 * query operators. Running $match afterward lets this reuse
 * buildListingStructuredFilter's output completely unmodified — the exact
 * same filter object browseListings runs, so the two search paths can't
 * silently disagree about what "matches the filters" means.
 */
const searchViaVectorIndex = async ({ filter, queryEmbedding, limitNum, skip }) => {
  const [result] = await Listing.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: CANDIDATE_POOL_SIZE * 5, // meaningfully larger than the eventual pool, per Atlas's own recall guidance
        limit: CANDIDATE_POOL_SIZE,
      },
    },
    { $match: filter },
    { $addFields: { semanticScore: { $meta: "vectorSearchScore" } } },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limitNum }],
        totalCount: [{ $count: "total" }],
      },
    },
  ]);
  return result;
};

/**
 * Used whenever $vectorSearch itself fails — no Atlas Search index
 * configured yet (a real possibility on a fresh deployment; see
 * scripts/createVectorSearchIndex.js), or a non-Atlas MongoDB entirely
 * (every automated test, via MongoMemoryServer, which doesn't implement
 * Atlas Search at all). Semantic search degrades to "still works, just
 * without the optimized index," never to "broken" — the same cold-start
 * philosophy as Phase 8/12's recommendation fallbacks.
 */
const searchViaInMemoryFallback = async ({ filter, queryEmbedding, limitNum, skip }) => {
  const candidates = await Listing.find({ ...filter, embedding: { $exists: true } })
    .select("+embedding")
    .limit(CANDIDATE_POOL_SIZE);

  const scored = candidates
    .map((listing) => ({ listing, semanticScore: cosineSimilarity(queryEmbedding, listing.embedding) }))
    .sort((a, b) => b.semanticScore - a.semanticScore);

  const data = scored.slice(skip, skip + limitNum).map(({ listing, semanticScore }) => {
    const obj = listing.toObject();
    delete obj.embedding;
    obj.semanticScore = semanticScore;
    return obj;
  });

  return { data, totalCount: [{ total: scored.length }] };
};

/**
 * POST /api/search/semantic — free-text query for intent, the same
 * structured filters as /browse for hard constraints (price/location/etc):
 * "don't let the embedding guess at things the user already told you
 * precisely."
 */
export const semanticSearch = async (requester, { query, page = 1, limit = 20, ...structuredFilters }) => {
  const filter = buildListingStructuredFilter(requester, structuredFilters);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const queryEmbedding = await embedQuery(query);

  let result;
  try {
    result = await searchViaVectorIndex({ filter, queryEmbedding, limitNum, skip });
  } catch (err) {
    console.warn(`Semantic search: $vectorSearch unavailable, using in-memory fallback (${err.message})`);
  }
  if (!result) {
    result = await searchViaInMemoryFallback({ filter, queryEmbedding, limitNum, skip });
  }

  return {
    listings: result.data || [],
    pagination: { page: pageNum, limit: limitNum, total: result.totalCount?.[0]?.total || 0 },
  };
};
