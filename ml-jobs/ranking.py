"""
Phase 12 — learning-to-rank for browse/search result ordering.

Weak supervision: a `search` Event's later view_listing/interest_sent
events (same session, within RESPONSE_WINDOW_MINUTES) are treated as "this
result should have ranked higher" signal for a LightGBM ranking model
(objective="lambdarank"), grouped by search session. This is the standard
click-log-based LTR setup, just using this product's actual signals (views,
interest) in place of raw clicks.

Trains on the full feature set the roadmap specifies (content-match,
distance, price fit, avgRating, reviewCount, response rate, verification
tier) — but server/src/modules/listings/listings.service.js's
sort=recommended only applies the subset that's cheap to compute on every
browse request without a personalized-to-the-requester context (rating,
reviewCount, verification). The rest inform what the model learns without
needing a live runtime equivalent — a standard "distill a trained model
into a servable subset" simplification, not a shortcut around the real
training.
"""

import itertools
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import lightgbm as lgb
import numpy as np

from db import get_db

RESPONSE_WINDOW_MINUTES = 30
MAX_UNENGAGED_PER_GROUP = 15  # keeps one busy search session from dominating training
MIN_GROUPS_TO_TRAIN = 3
MIN_ROWS_TO_TRAIN = 15

FEATURE_NAMES = [
    "content_match",
    "distance_km",
    "price_fit",
    "avg_rating",
    "review_count",
    "response_rate",
    "verification",
]
# Only this subset gets served live (see module docstring) — RankingConfig's shape.
SERVED_FEATURES = ["avg_rating", "review_count", "verification"]
SERVED_WEIGHT_KEYS = {"avg_rating": "rating", "review_count": "reviewCount", "verification": "verification"}

VERIFICATION_SCORES = {"fully_verified": 1.0, "id_verified": 0.5, "none": 0.0}


def _haversine_km(a, b):
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371.0
    d_lat = np.radians(lat2 - lat1)
    d_lon = np.radians(lon2 - lon1)
    h = np.sin(d_lat / 2) ** 2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(d_lon / 2) ** 2
    return 2 * r * np.arcsin(np.sqrt(h))


def _load_teacher_features(db):
    """ownerId (str) -> {avg_rating, review_count, verification, location}."""
    features = {}
    for profile in db.teacherprofiles.find(
        {}, {"userId": 1, "avgRating": 1, "reviewCount": 1, "verificationStatus": 1, "location": 1}
    ):
        features[str(profile["userId"])] = {
            "avg_rating": profile.get("avgRating", 0) or 0,
            "review_count": profile.get("reviewCount", 0) or 0,
            "verification": VERIFICATION_SCORES.get(profile.get("verificationStatus"), 0.0),
            "location": (profile.get("location") or {}).get("coordinates"),
        }
    return features


def _load_response_rates(db):
    """teacherId (str, i.e. toUserId) -> accepted / (accepted + declined).
    A teacher who's never responded to anything is left out entirely (NaN
    at training time), not assumed 0 — "no data" and "always declines" are
    different things and shouldn't be conflated."""
    counts = defaultdict(lambda: {"accepted": 0, "declined": 0})
    for doc in db.interestrequests.find({"status": {"$in": ["accepted", "declined"]}}, {"toUserId": 1, "status": 1}):
        counts[str(doc["toUserId"])][doc["status"]] += 1
    rates = {}
    for teacher_id, c in counts.items():
        total = c["accepted"] + c["declined"]
        if total > 0:
            rates[teacher_id] = c["accepted"] / total
    return rates


def _search_candidate_filter(metadata):
    query = {"type": "teacher_ad", "status": "active"}
    if metadata.get("subject"):
        query["subject"] = metadata["subject"]
    if metadata.get("grade"):
        query["grade"] = metadata["grade"]
    if metadata.get("medium"):
        query["medium"] = metadata["medium"]
    return query


def build_training_rows(db):
    teacher_features = _load_teacher_features(db)
    response_rates = _load_response_rates(db)

    searches = db.events.find({"action": "search"}, {"userId": 1, "sessionId": 1, "metadata": 1, "createdAt": 1})

    rows = []
    group_id = 0
    for search in searches:
        session_id, user_id = search.get("sessionId"), search.get("userId")
        if not session_id and not user_id:
            continue  # nothing to group this search's downstream activity by

        window_end = search["createdAt"] + timedelta(minutes=RESPONSE_WINDOW_MINUTES)
        or_clauses = []
        if session_id:
            or_clauses.append({"sessionId": session_id})
        if user_id:
            or_clauses.append({"userId": user_id})

        engaged = {}
        downstream = db.events.find(
            {
                "action": {"$in": ["view_listing", "interest_sent"]},
                "createdAt": {"$gte": search["createdAt"], "$lte": window_end},
                "$or": or_clauses,
            },
            {"targetId": 1, "action": 1},
        )
        for event in downstream:
            label = 2 if event["action"] == "interest_sent" else 1
            key = str(event["targetId"])
            engaged[key] = max(engaged.get(key, 0), label)

        candidates = list(db.listings.find(_search_candidate_filter(search.get("metadata") or {}), {"ownerId": 1, "price": 1}))
        engaged_candidates = [c for c in candidates if str(c["_id"]) in engaged]
        if not engaged_candidates:
            continue  # no positive signal from this search — nothing for a ranking loss to contrast against
        unengaged_candidates = [c for c in candidates if str(c["_id"]) not in engaged][:MAX_UNENGAGED_PER_GROUP]
        group_candidates = engaged_candidates + unengaged_candidates
        if len(group_candidates) < 2:
            continue

        meta = search.get("metadata") or {}
        search_lat_lng = (float(meta["lng"]), float(meta["lat"])) if meta.get("lat") is not None and meta.get("lng") is not None else None
        min_price, max_price = meta.get("minPrice"), meta.get("maxPrice")
        budget_mid = (float(min_price) + float(max_price)) / 2 if min_price is not None and max_price is not None else None

        for listing in group_candidates:
            owner_id = str(listing["ownerId"])
            tf = teacher_features.get(owner_id, {})
            location = tf.get("location")
            price_amount = (listing.get("price") or {}).get("amount")

            rows.append(
                {
                    "group": group_id,
                    "label": engaged.get(str(listing["_id"]), 0),
                    "content_match": 1.0,
                    "distance_km": _haversine_km(search_lat_lng, location) if search_lat_lng and location else np.nan,
                    "price_fit": abs(price_amount - budget_mid) if budget_mid is not None and price_amount is not None else np.nan,
                    "avg_rating": tf.get("avg_rating", np.nan),
                    "review_count": tf.get("review_count", np.nan),
                    "response_rate": response_rates.get(owner_id, np.nan),
                    "verification": tf.get("verification", np.nan),
                }
            )
        group_id += 1

    return rows


def run(db=None):
    # Not `db or get_db()` — pymongo's Database explicitly raises on
    # bool(database) to stop exactly this kind of truthiness check.
    db = db if db is not None else get_db()
    rows = build_training_rows(db)

    groups = {r["group"] for r in rows}
    if len(groups) < MIN_GROUPS_TO_TRAIN or len(rows) < MIN_ROWS_TO_TRAIN:
        print(
            f"[ranking] only {len(rows)} row(s) across {len(groups)} session(s) - "
            "skipping, not enough weak-supervision data yet"
        )
        return None

    rows.sort(key=lambda r: r["group"])
    X = np.array([[r[f] for f in FEATURE_NAMES] for r in rows], dtype=np.float64)
    y = np.array([r["label"] for r in rows], dtype=np.int32)
    group_sizes = [len(list(g)) for _, g in itertools.groupby(rows, key=lambda r: r["group"])]

    ranker = lgb.LGBMRanker(objective="lambdarank", n_estimators=100, num_leaves=15, min_child_samples=1, verbosity=-1)
    ranker.fit(X, y, group=group_sizes)

    importances = dict(zip(FEATURE_NAMES, ranker.booster_.feature_importance(importance_type="gain")))
    served = {f: float(importances.get(f, 0.0)) for f in SERVED_FEATURES}
    total = sum(served.values())
    if total <= 0:
        # No signal at all for the servable features specifically (e.g.
        # every session only ever varied on price/distance) — leave
        # whatever weights are already in place rather than overwrite them
        # with zeros, which would make sort=recommended stop discriminating.
        print(
            "[ranking] trained, but none of the servable features "
            "(rating/reviewCount/verification) carried signal - leaving RankingConfig untouched"
        )
        return None

    weights = {SERVED_WEIGHT_KEYS[f]: round(100 * v / total, 1) for f, v in served.items()}

    db.rankingconfigs.replace_one(
        {"_id": "listing_ranking"},
        {"_id": "listing_ranking", "weights": weights, "trainedOnSamples": len(rows), "computedAt": datetime.now(timezone.utc)},
        upsert=True,
    )
    print(f"[ranking] trained on {len(rows)} rows across {len(groups)} sessions; wrote weights {weights}")
    return weights


if __name__ == "__main__":
    run()
