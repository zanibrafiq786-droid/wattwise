"""
sim/generate_month.py -- CLAUDE.md section 6.4: a realistic simulated month
of room events (with seeded randomness), so the Report tab's waste report and
AI explanation can be demoed even on days with only a few hours of real
sensor data.

SAFETY: writes ONLY to /sim/room1/events and /sim/meta/simulated -- never to
/room1/events, /room1/state, /alerts, or anything else real. It cannot
overwrite real data no matter what flags are passed (earlier versions of this
script wrote to /room1/events directly and needed a --force guard; that
whole class of risk is gone now that it's a separate path). The app has a
"Data source" toggle (Setup tab) that switches the Report tab between
/room1/events (real) and /sim/room1/events (this), labeling the simulated
one SIMULATED everywhere it's shown -- see app/src/lib/dataSourceContext.tsx.

Usage:
    python generate_month.py            # writes to /sim/room1/events
    python generate_month.py --dry-run  # just prints a summary, writes nothing
"""
import argparse
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

from firebase_admin import db

sys.path.insert(0, str(Path(__file__).parent.parent / "brain"))
from firebase_db import get_app  # noqa: E402

SEED = 20261012  # fixed seed -- same simulated month every run, for reproducible demos
DAYS = 30


def generate_events(days: int = DAYS, seed: int = SEED) -> list:
    """One plausible day pattern, repeated with small random variation:
    - night (0-6h): empty, light off, fan off
    - morning (6-9h): active, light on, fan on
    - day (9-17h): mostly empty (school/work), occasionally active;
      light/fan sometimes left on when leaving -- this is the "waste" the
      report is meant to find
    - evening (17-23h): active, light on, fan on (hot evenings)
    """
    rng = random.Random(seed)
    events = []
    end = datetime.now()
    start = end - timedelta(days=days)
    t = start

    def push(ts: datetime, presence: str, light_on: bool, fan_on: bool):
        events.append(
            {
                "ts": int(ts.timestamp() * 1000),
                "presence": presence,
                "light_on": light_on,
                "fan_on": fan_on,
            }
        )

    while t < end:
        hour = t.hour
        left_on_by_mistake = rng.random() < 0.15  # ~15% of the time, forget to turn off on leaving

        if hour < 6:
            push(t, "empty", False, False)
        elif hour < 9:
            push(t, "active", True, True)
        elif hour < 17:
            if left_on_by_mistake:
                push(t, "empty", True, rng.random() < 0.5)
            else:
                push(t, "empty", False, False)
        else:
            push(t, "active", True, True)

        t += timedelta(minutes=rng.randint(45, 90))

    return events


def write_to_firebase(events: list):
    get_app()
    db.reference("/sim/room1/events").set({f"sim_{i}": e for i, e in enumerate(events)})
    db.reference("/sim/meta/simulated").set(True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate a simulated month of room events, written to /sim/room1/events only.")
    parser.add_argument("--days", type=int, default=DAYS)
    parser.add_argument("--dry-run", action="store_true", help="Print a summary only, write nothing.")
    args = parser.parse_args()

    events = generate_events(args.days)
    print(f"Generated {len(events)} simulated events across {args.days} days (seed={SEED}).")

    if args.dry_run:
        print("Dry run -- nothing written. Sample:", events[:3])
    else:
        write_to_firebase(events)
        print("Wrote to /sim/room1/events and /sim/meta/simulated = true.")
        print("Your real /room1/events, /room1/state, and /alerts were not touched.")
        print('Switch "Data source" to Simulated in the app\'s Setup tab to see it in the Report tab.')
