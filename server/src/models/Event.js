import mongoose from "mongoose";

/**
 * Event — raw interaction log. Write-only infrastructure: nothing reads this
 * yet (Phase 8's content-based recommendations don't need it; Phase 12's
 * collaborative filtering and Phase 15's admin analytics do, later). It's
 * logged from here on regardless, because event history is worthless if you
 * only start collecting it the day something finally needs it.
 *
 * `targetId` deliberately has no `ref`/`refPath` — targetType is a coarse
 * category ("listing", "profile"), not a single collection a populate could
 * resolve against (a "profile" view could mean a User id being looked at via
 * either TeacherProfile or StudentProfile). Nothing here needs population;
 * this collection is written to, not joined against, in this phase.
 */
const eventSchema = new mongoose.Schema(
  {
    // Null for a guest — sessionId is what correlates their activity instead.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Client-generated UUID, sent via the `X-Session-Id` header once Phase 6F's
    // frontend exists to generate and persist one — optional until then, so
    // this phase's backend-only wiring doesn't require a client change first.
    sessionId: {
      type: String,
      default: null,
    },

    // interest_sent/interest_accepted aren't emitted by anything yet — Phase
    // 10B (Interest & Contact Request Flow) doesn't exist. Listed here now so
    // the schema doesn't need revisiting when it does. filter_apply is also
    // unwired for now — see event.service.js's comment on why.
    action: {
      type: String,
      enum: [
        "view_listing",
        "view_profile",
        "search",
        "filter_apply",
        "interest_sent",
        "interest_accepted",
      ],
      required: true,
    },

    targetType: {
      type: String,
      enum: ["listing", "profile"],
      default: null,
    },

    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // e.g. { subject, grade, filters } for a search event.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL — raw events get large fast; auto-expire after 180 days rather than
// growing this collection unbounded. A rollup-into-daily-summaries job is
// the other option the roadmap allows for, but isn't needed for this phase.
eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// For the analytics queries Phase 15 will run (e.g. "how many searches for
// subject X in the last 30 days").
eventSchema.index({ action: 1, createdAt: -1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
