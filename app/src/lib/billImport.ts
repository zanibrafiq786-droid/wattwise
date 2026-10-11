// In-app bill photo -> AI extraction -> Firebase /bills.
//
// SECURITY NOTE: this calls Gemini directly from the phone using
// EXPO_PUBLIC_GEMINI_API_KEY, which ships inside the app bundle and can be
// extracted from the built APK. The brief's own rule is "LLM key from .env,
// never in the mobile app" -- this was a deliberate, informed exception for
// demo speed (see brain/import_bill.py for the safer version, where the key
// stays on the laptop). Don't copy this pattern elsewhere without the same
// explicit tradeoff discussion.
import { saveBill } from "./firebase";

export interface TariffLine {
  label: string;
  amount_rs: number;
}

export interface BillHistoryEntry {
  month: string;
  units: number;
  amount_rs: number;
}

export interface ExtractedBill {
  reference_redacted: string | null;
  billing_month: string | null;
  units: number | null;
  amount_rs: number | null;
  due_date: string | null;
  tariff_lines: TariffLine[];
  history_12m: BillHistoryEntry[];
  notes: string;
}

const EXTRACTION_PROMPT = `This is a photo or scan of a Pakistani electricity (FESCO/DISCO) bill.
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
If a field truly isn't on the bill, use null (for scalars) or an empty array/string, not a guess.`;

function extractJson(text: string): ExtractedBill {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(cleaned);
}

export async function extractBillFromImage(base64: string, mimeType: string): Promise<ExtractedBill> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  const model = process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-3.1-flash-lite";
  if (!apiKey) {
    throw new Error("EXPO_PUBLIC_GEMINI_API_KEY is not set in app/.env");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ inline_data: { mime_type: mimeType, data: base64 } }, { text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no text in its response.");
  }
  return extractJson(text);
}

export interface ValidationWarning {
  message: string;
}

// Mirrors brain/import_bill.py's validate() -- same checks, same spirit:
// flag anything that looks wrong rather than silently trusting the numbers.
export function validateExtractedBill(bill: ExtractedBill): string[] {
  const warnings: string[] = [];

  if (!bill.billing_month) warnings.push("No billing_month was read from the bill.");
  if (!bill.units || bill.units <= 0) warnings.push("units is missing or zero.");
  if (!bill.amount_rs || bill.amount_rs <= 0) warnings.push("amount_rs is missing or zero.");

  if (bill.tariff_lines?.length && bill.amount_rs) {
    const tariffTotal = bill.tariff_lines.reduce((s, l) => s + (l.amount_rs || 0), 0);
    if (bill.amount_rs > 0 && Math.abs(tariffTotal - bill.amount_rs) / bill.amount_rs > 0.1) {
      warnings.push(
        `Tariff line items add up to Rs ${tariffTotal.toFixed(0)}, which doesn't match the total Rs ${bill.amount_rs.toFixed(
          0
        )} (more than 10% off).`
      );
    }
  }

  for (const entry of bill.history_12m ?? []) {
    if (!entry.month || entry.units == null || entry.amount_rs == null) {
      warnings.push(`Incomplete history entry: ${JSON.stringify(entry)}`);
    }
  }

  return warnings;
}

// Writes the current bill + any history entries to Firebase, skipping the
// current month if it's already present in the history (avoids a duplicate
// write to the same key).
export async function saveExtractedBill(bill: ExtractedBill): Promise<string[]> {
  const monthsWritten: string[] = [];

  if (bill.billing_month && bill.units != null && bill.amount_rs != null) {
    await saveBill(bill.billing_month, { units: bill.units, amount_rs: bill.amount_rs });
    monthsWritten.push(bill.billing_month);
  }

  for (const entry of bill.history_12m ?? []) {
    if (entry.month && entry.units != null && entry.amount_rs != null && !monthsWritten.includes(entry.month)) {
      await saveBill(entry.month, { units: entry.units, amount_rs: entry.amount_rs });
      monthsWritten.push(entry.month);
    }
  }

  return monthsWritten;
}
