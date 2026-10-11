"""
import_bill.py <photo-or-pdf>

Reads one FESCO/DISCO electricity bill (photo or PDF), sends it to Google
Gemini (vision) to extract the numbers, validates what comes back, shows you
a summary, and -- only if you confirm -- writes units/amount per month to
Firebase /bills/{yyyy-mm}.

Privacy: the bill's 14-digit reference number is never written to Firebase
and never printed in full here (only the last 4 digits), even though the
photo itself is necessarily sent to Gemini for reading -- that's unavoidable
for OCR, but nothing derived from it leaves this script except numbers.

Usage:
    python import_bill.py path/to/bill.jpg
    python import_bill.py path/to/bill.pdf

(First tried Groq, but its free-tier key had no vision-capable model
available at the time; switched to Gemini, which does and also accepts PDFs
natively.)
"""
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

from firebase_db import write_bill

BRAIN_DIR = Path(__file__).parent
load_dotenv(BRAIN_DIR / ".env")

# Check https://ai.google.dev/gemini-api/docs/models for the current model
# name if this stops working.
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.1-flash-lite")

EXTRACTION_PROMPT = """This is a photo or scan of a Pakistani electricity (FESCO/DISCO) bill.
Read it carefully and return ONLY a single JSON object (no markdown fences, no extra text)
with exactly this shape:

{
  "reference_redacted": "last 4 digits only, e.g. 'XXXXXXXXXX1234', or null if not visible",
  "billing_month": "YYYY-MM for the month this bill covers",
  "units": number (units consumed this billing month, from the bill),
  "amount_rs": number (total payable amount in Rs),
  "due_date": "YYYY-MM-DD or null",
  "tariff_lines": [{"label": "string", "amount_rs": number}, ...] (line items that make up the bill, empty array if not legible),
  "history_12m": [{"month": "YYYY-MM", "units": number, "amount_rs": number}, ...]
    (the past-consumption history table/graph printed on the bill, oldest first, as many months as are visible -- often 12),
  "notes": "anything you are unsure about or could not read clearly, empty string if nothing"
}

Never include more than the last 4 digits of any account/reference number anywhere in your answer.
If a field truly isn't on the bill, use null (for scalars) or an empty array/string, not a guess.
"""


def redact(s: str | None) -> str:
    if not s:
        return "(none)"
    # Safety net regardless of what the model already did: keep only the
    # last 4 digits of any long digit run.
    return re.sub(r"\d{5,}(\d{4})", r"[redacted]\1", s)


def load_file_as_part(path: Path) -> types.Part:
    ext = path.suffix.lower()
    media_type = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".pdf": "application/pdf",
    }.get(ext)
    if not media_type:
        raise ValueError(f"Unsupported file type: {ext}. Use .jpg, .jpeg, .png, .webp or .pdf")
    return types.Part.from_bytes(data=path.read_bytes(), mime_type=media_type)


def extract_json(text: str) -> dict:
    # Claude is asked for raw JSON, but strip code fences defensively in
    # case it wraps the answer anyway.
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
    return json.loads(text)


def validate(bill: dict) -> list[str]:
    """Returns a list of human-readable warnings. Does not raise -- the
    person importing the bill decides whether to proceed despite warnings."""
    warnings = []

    if not bill.get("billing_month"):
        warnings.append("No billing_month was read from the bill.")
    if not bill.get("units") or bill["units"] <= 0:
        warnings.append("units is missing or zero.")
    if not bill.get("amount_rs") or bill["amount_rs"] <= 0:
        warnings.append("amount_rs is missing or zero.")

    tariff_lines = bill.get("tariff_lines") or []
    if tariff_lines and bill.get("amount_rs"):
        tariff_total = sum(line.get("amount_rs", 0) for line in tariff_lines)
        amount = bill["amount_rs"]
        if amount > 0 and abs(tariff_total - amount) / amount > 0.1:
            warnings.append(
                f"Tariff line items add up to Rs {tariff_total:.0f}, which doesn't match "
                f"the total Rs {amount:.0f} (more than 10% off). The bill may have taxes/"
                f"adjustments not listed as line items, or a line was misread."
            )

    for entry in bill.get("history_12m", []):
        if not entry.get("month") or entry.get("units") is None or entry.get("amount_rs") is None:
            warnings.append(f"Incomplete history entry: {entry}")

    return warnings


def main():
    if len(sys.argv) != 2:
        print("Usage: python import_bill.py <path-to-bill-photo-or-pdf>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is not set in brain/.env (get a free key at https://aistudio.google.com/apikey)")
        sys.exit(1)

    print(f"Reading {path.name} and sending it to Gemini ({MODEL}) for extraction...")
    client = genai.Client(api_key=api_key)
    file_part = load_file_as_part(path)

    response = client.models.generate_content(
        model=MODEL,
        contents=[file_part, EXTRACTION_PROMPT],
    )
    raw_text = response.text

    try:
        bill = extract_json(raw_text)
    except json.JSONDecodeError as e:
        print("Could not parse Gemini's response as JSON. Raw response was:")
        print(raw_text)
        print(f"\nError: {e}")
        sys.exit(1)

    print("\n--- Extracted ---")
    print(f"Reference (redacted): {redact(bill.get('reference_redacted'))}")
    print(f"Billing month: {bill.get('billing_month')}")
    print(f"Units: {bill.get('units')}")
    print(f"Amount: Rs {bill.get('amount_rs')}")
    print(f"Due date: {bill.get('due_date')}")
    if bill.get("notes"):
        print(f"Notes from Gemini: {bill['notes']}")

    history = bill.get("history_12m", [])
    if history:
        print(f"\n--- 12-month history found ({len(history)} entries) ---")
        for entry in history:
            print(f"  {entry.get('month')}: {entry.get('units')} units, Rs {entry.get('amount_rs')}")
    else:
        print("\nNo 12-month history table was found on this bill.")

    warnings = validate(bill)
    if warnings:
        print("\n--- WARNINGS (check these before trusting the numbers) ---")
        for w in warnings:
            print(f"  - {w}")

    print()
    answer = input("Write this data to Firebase /bills? [y/N]: ").strip().lower()
    if answer != "y":
        print("Not written. Nothing was saved.")
        return

    months_written = []
    if bill.get("billing_month") and bill.get("units") and bill.get("amount_rs"):
        write_bill(bill["billing_month"], bill["units"], bill["amount_rs"])
        months_written.append(bill["billing_month"])

    for entry in history:
        month = entry.get("month")
        units = entry.get("units")
        amount = entry.get("amount_rs")
        if month and units is not None and amount is not None and month not in months_written:
            write_bill(month, units, amount)
            months_written.append(month)

    print(f"\nWrote {len(months_written)} month(s) to Firebase: {', '.join(sorted(months_written))}")


if __name__ == "__main__":
    main()
