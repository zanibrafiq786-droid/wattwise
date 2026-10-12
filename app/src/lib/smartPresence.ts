import { useEffect, useRef, useState } from "react";
import { RoomState } from "./types";

// The app's own presence decision, used everywhere on Home (hero pill, waste
// alert, Wi-Fi room animation) so they always agree.
//
// Why not just use the firmware's `presence`: in a real test in this room
// the firmware said "empty" the whole time someone walked around -- its
// built-in threshold (rssi_var > 2.0) never triggered, while the signal
// clearly rose (empty 0.29-0.44, walking 0.73-1.24). The firmware isn't
// changed (project rule), so the app decides from the same rssi_var with a
// threshold tuned to this room (default, or from the in-app calibration).
//
// Two practical details:
// - The board only sends an update every ~20-30 s (sometimes minutes), and
//   each rssi_var is a ~1.6 s snapshot, so one low reading doesn't mean the
//   room emptied: presence is HELD for a while after the last detection.
// - The firmware's own "active"/"quiet" still counts as a detection.
export type SmartPresence = "empty" | "sitting" | "walking";

const WALK_FACTOR = 1.6; // rssi_var >= threshold * 1.6 reads as walking
const WALK_HOLD_MS = 45_000;
const PRESENT_HOLD_MS = 120_000;

export function useSmartPresence(state: RoomState | null, threshold: number) {
  const lastSeen = useRef<number | null>(null);
  const lastWalk = useRef<number | null>(null);
  const changedAt = useRef<number | null>(null);
  const current = useRef<SmartPresence>("empty");
  const [, tick] = useState(0);

  // Feed each new reading in.
  useEffect(() => {
    if (!state) return;
    const t = state.updated_at || Date.now();
    const rv = state.rssi_var ?? 0;
    const walkingNow = state.presence === "active" || rv >= threshold * WALK_FACTOR;
    const presentNow = walkingNow || state.presence === "quiet" || rv >= threshold;
    if (walkingNow) lastWalk.current = t;
    if (presentNow) lastSeen.current = t;
    tick((n) => n + 1);
  }, [state?.updated_at, threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-evaluate on a timer too: holds expire even when no new reading comes.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const now = Date.now();
  let presence: SmartPresence = "empty";
  if (lastWalk.current && now - lastWalk.current < WALK_HOLD_MS) presence = "walking";
  else if (lastSeen.current && now - lastSeen.current < PRESENT_HOLD_MS) presence = "sitting";

  if (presence !== current.current || changedAt.current === null) {
    current.current = presence;
    changedAt.current = now;
  }

  const ageMs = state ? now - state.updated_at : null;
  return {
    presence,
    since: changedAt.current,
    // The board has gone quiet for a while -- say so instead of silently
    // showing an old state as if it were live.
    staleMs: ageMs !== null && ageMs > 60_000 ? ageMs : null,
  };
}

// In-app Wi-Fi calibration: record the signal with the room empty, then
// while walking, and put the threshold between the two. Uses the same live
// readings the app already receives -- no firmware change.
export type CalibStep = "idle" | "empty" | "walking" | "done" | "failed";
const STEP_MS = 75_000; // ~3 readings each at the board's current update rate

export function useWifiCalibration(state: RoomState | null, onResult: (threshold: number) => Promise<void>) {
  const [step, setStep] = useState<CalibStep>("idle");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const emptySamples = useRef<number[]>([]);
  const walkSamples = useRef<number[]>([]);
  const stepEndsAt = useRef(0);

  useEffect(() => {
    if (!state || (step !== "empty" && step !== "walking")) return;
    (step === "empty" ? emptySamples : walkSamples).current.push(state.rssi_var);
  }, [state?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== "empty" && step !== "walking") return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((stepEndsAt.current - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left > 0) return;
      clearInterval(id); // stop before switching/finishing so this can't fire twice
      if (step === "empty") {
        stepEndsAt.current = Date.now() + STEP_MS;
        setStep("walking");
      } else {
        finishSafely();
      }
    }, 500);
    return () => clearInterval(id);
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finish() {
    const e = emptySamples.current;
    const w = walkSamples.current;
    if (e.length < 2 || w.length < 2) {
      setStep("failed");
      setMessage(`Too few readings from the sensor (${e.length} empty, ${w.length} walking). It may not be sending -- check it's powered and online, then try again.`);
      return;
    }
    const emptyMax = Math.max(...e);
    const walkSorted = [...w].sort((a, b) => a - b);
    const walkMedian = walkSorted[Math.floor(walkSorted.length / 2)];
    if (walkMedian <= emptyMax) {
      const thr = +(emptyMax * 1.15).toFixed(2);
      await onResult(thr);
      setStep("done");
      setMessage(`Walking (${walkMedian.toFixed(2)}) barely differs from empty (${emptyMax.toFixed(2)}). Saved ${thr} anyway -- moving the ESP32 so you walk between it and the router will help.`);
      return;
    }
    const thr = +((emptyMax + walkMedian) / 2).toFixed(2);
    await onResult(thr);
    setStep("done");
    setMessage(`Empty peaked at ${emptyMax.toFixed(2)}, walking around ${walkMedian.toFixed(2)}. New threshold: ${thr}.`);
  }

  async function finishSafely() {
    try {
      await finish();
    } catch {
      setStep("failed");
      setMessage("Couldn't save the new threshold. Check your connection and try again.");
    }
  }

  function start() {
    emptySamples.current = [];
    walkSamples.current = [];
    setMessage(null);
    stepEndsAt.current = Date.now() + STEP_MS;
    setSecondsLeft(Math.ceil(STEP_MS / 1000));
    setStep("empty");
  }

  function reset() {
    setStep("idle");
    setMessage(null);
  }

  return { step, secondsLeft, message, start, reset };
}
