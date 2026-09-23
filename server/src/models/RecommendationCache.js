import mongoose from "mongoose";

/**
 * RecommendationCache — written by the offline collaborative-filtering job
 * (ml-jobs/, Python), read by recommendations.service.js to blend a learned
 * score into Phase 8's live content-based score. This collection is the
 * entire coupling between Node and Python: Node never calls Python
 * synchronously, only reads what the last batch run left here — a cron job
 * and a shared database, not a live RPC dependency.
 *
 * One document per user (student or teacher — whichever side the recs are
 * for), holding whichever OTHER users the ALS model recommends. A missing
 * document (never run yet, or a brand-new user with no interaction history
 * for the model to learn from) is a normal, expected state — the reader
 * falls back to pure Phase 8 scoring, not an error.
 */
const recommendationCacheSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  recommendations: [
    {
      _id: false,
      targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      // Same 0-100 scale as Phase 8's content score, so the two blend
      // directly without a conversion step at read time.
      score: { type: Number, required: true, min: 0, max: 100 },
    },
  ],
  computedAt: { type: Date, required: true },
});

const RecommendationCache = mongoose.model("RecommendationCache", recommendationCacheSchema);

export default RecommendationCache;
