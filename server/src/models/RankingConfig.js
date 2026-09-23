import mongoose from "mongoose";

/**
 * RankingConfig — a single current-best-weights document, written by the
 * offline learning-to-rank job (ml-jobs/, Python's LightGBM ranker) and read
 * by listings.service.js's `sort=recommended` browse option.
 *
 * The Python job trains on the full feature set the roadmap specifies
 * (content-match, distance, price fit, avgRating, reviewCount, response
 * rate, verification tier) — but only the subset that's cheap to compute on
 * every browse request without a personalized-to-the-requester context
 * (rating, reviewCount, verification) gets served live; the rest inform
 * training without needing a live runtime equivalent. Distance keeps using
 * the existing $geoNear-based sort untouched, same as every other sort
 * option — it isn't part of this blended score.
 *
 * Singleton by convention (fixed _id) — only the latest training run's
 * weights ever matter, there's no history to keep.
 */
const rankingConfigSchema = new mongoose.Schema({
  _id: { type: String, default: "listing_ranking" },
  weights: {
    rating: { type: Number, required: true },
    reviewCount: { type: Number, required: true },
    verification: { type: Number, required: true },
  },
  trainedOnSamples: { type: Number, required: true },
  computedAt: { type: Date, required: true },
});

const RankingConfig = mongoose.model("RankingConfig", rankingConfigSchema);

export default RankingConfig;
