"""
migrate_to_user.py -- one-time move to per-account data.

Before: bills/config/reports lived at the top of the database (/bills,
/config, /reports), so every account saw the same numbers. Now each account
has its own /users/{uid}/bills, /config, /reports, and the ESP32's room is
linked to one account via /users/{uid}/device.

This COPIES the old shared data into one account and links the sensor to it.
It never deletes or changes the old paths -- they stay as a backup.
Every month with units is copied, amounts exactly as stored (small or
negative amounts are real for solar net-metering homes).

Usage:
    python migrate_to_user.py <uid> [--device room1]
"""
import argparse

from firebase_admin import db

from firebase_db import get_app


def plausible(b: dict) -> bool:
    # Any month with units. (An earlier version also required a "normal"
    # Rs/unit amount and wrongly left out real solar net-metering bills.)
    return (b.get("units") or 0) > 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("uid")
    p.add_argument("--device", default="room1")
    args = p.parse_args()
    get_app()
    base = f"/users/{args.uid}"

    bills = db.reference("/bills").get() or {}
    good = {m: b for m, b in bills.items() if plausible(b)}
    if good:
        db.reference(f"{base}/bills").update(good)
    print(f"bills: copied {len(good)} real-looking, left {len(bills) - len(good)} implausible ones only in /bills")

    config = db.reference("/config").get()
    if config:
        db.reference(f"{base}/config").update(config)
        print("config: copied")

    reports = db.reference("/reports").get()
    if reports:
        db.reference(f"{base}/reports").update(reports)
        print(f"reports: copied {len(reports)}")

    db.reference(f"{base}/device").set(args.device)
    print(f"device: linked {args.device} to this account")


if __name__ == "__main__":
    main()
