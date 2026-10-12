// In-app bill photo -> read on the laptop -> saved to this account's bills.
//
// No AI key in the app: the phone writes the photo to
// /users/{uid}/bill_scans/{id}; brain/bill_scan.py (run by chat_worker.py)
// reads it with the key that only lives in brain/.env, saves the bill rows,
// writes the result back to the same node and deletes the photo. Same
// transport pattern as the chat and solar features.
import { onValue, ref, set } from "firebase/database";
import { auth, db } from "../../firebaseConfig";
import { runInCloud } from "./cloudBrain";

export interface SaveResult {
  saved: { month: string; units: number; amount_rs?: number | null }[];
  skipped: { month: string; reason: string }[];
}

const TIMEOUT_MS = 90_000;

export function scanBill(base64: string, mimeType: string): Promise<SaveResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) return Promise.reject(new Error("Not signed in."));
  const id = `scan_${Date.now()}`;
  const node = ref(db, `/users/${uid}/bill_scans/${id}`);

  return new Promise((resolve, reject) => {
    let unsub: (() => void) | null = null;
    const timer = setTimeout(() => {
      unsub?.();
      reject(
        new Error(
          "The bill reader didn't answer. Check your internet connection and try again."
        )
      );
    }, TIMEOUT_MS);

    unsub = onValue(node, (snap) => {
      const v = snap.val();
      if (!v || !v.status) return; // still just the photo -- waiting
      clearTimeout(timer);
      unsub?.();
      if (v.status === "error") {
        reject(new Error(v.error || "Couldn't read the bill. Please try again."));
        return;
      }
      resolve({ saved: v.saved ?? [], skipped: v.skipped ?? [] });
    });

    set(node, { image_b64: base64, mime: mimeType, ts: Date.now() })
      .then(() => runInCloud("scan", id))
      .catch((err) => {
      clearTimeout(timer);
      unsub?.();
      reject(err);
    });
  });
}
