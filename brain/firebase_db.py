"""
Shared Firebase Realtime Database access for the brain/ Python scripts.
Uses the Admin SDK (service account), which can read and write anything --
unlike the app, which only ever uses the public Firebase JS SDK.
"""
import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, db

BRAIN_DIR = Path(__file__).parent
load_dotenv(BRAIN_DIR / ".env")

_app = None


def get_app():
    global _app
    if _app is not None:
        return _app

    database_url = os.environ.get("FIREBASE_DATABASE_URL")
    service_account_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not database_url or not service_account_path:
        raise RuntimeError(
            "FIREBASE_DATABASE_URL and FIREBASE_SERVICE_ACCOUNT_PATH must be set in brain/.env"
        )

    # service_account_path is relative to brain/, not the current working directory.
    key_path = (BRAIN_DIR / service_account_path).resolve()
    if not key_path.exists():
        raise RuntimeError(f"Service account key not found at {key_path}")

    cred = credentials.Certificate(str(key_path))
    _app = firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    return _app


def write_bill(month_key: str, units: float, amount_rs: float):
    """Writes /bills/{yyyy-mm} = {units, amount_rs}. Overwrites any existing
    value for that month -- call sites should confirm with the user first
    when replacing real data with a new import."""
    get_app()
    db.reference(f"/bills/{month_key}").set({"units": units, "amount_rs": amount_rs})


def read_bill(month_key: str):
    get_app()
    return db.reference(f"/bills/{month_key}").get()


def read_all_bills() -> dict:
    get_app()
    return db.reference("/bills").get() or {}
