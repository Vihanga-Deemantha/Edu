"""
Entry point for the Phase 12 batch job — "nightly retrain + score" per the
roadmap. Run manually (`python run.py`) or on a schedule (cron / Windows
Task Scheduler); there's no server here, this connects to MongoDB, does its
work, and exits. Node never calls this — it only reads what the last run
left in RecommendationCache / RankingConfig.
"""

import os

# Must be set before numpy/implicit are imported (they read it at import
# time to configure BLAS) — otherwise OpenBLAS defaults to one thread per
# CPU core, which implicit's own docs warn is actively harmful to ALS
# performance here, not just noisy.
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

from datetime import datetime, timezone  # noqa: E402

import collaborative_filtering  # noqa: E402
import ranking  # noqa: E402
from db import get_db  # noqa: E402


def main():
    db = get_db()
    started_at = datetime.now(timezone.utc)
    print(f"[run] starting at {started_at.isoformat()}")

    collaborative_filtering.run(db)
    ranking.run(db)

    print(f"[run] finished in {(datetime.now(timezone.utc) - started_at).total_seconds():.1f}s")


if __name__ == "__main__":
    main()
