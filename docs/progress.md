# Progress Log

Running log of what's been done, in order. Deadline: Monday Oct 12, 7 PM (Pakistan time).

## Gate 0 — Scaffold + Firebase

- Created repo layout: `/firmware`, `/brain`, `/app`, `/docs`, `/sim`, `.gitignore`, `.env.example`.
- Firebase project created by user (Realtime Database, test-mode rules — **still insecure, must be locked down after the hackathon**).
- Database URL: `https://wifi-324bd-default-rtdb.asia-southeast1.firebasedatabase.app`

## Firmware

- Built independently by the user (not touched by Claude Code, by instruction).
- Writes to Firebase every second:
  - `/room1/state`: `presence` ("active"/"quiet"/"empty"), `light_on`, `fan_on`, `temp_c`, `humidity`, `ldr`, `vib`, `rssi_var`, `updated_at`
  - `/room1/events/{id}`: `ts`, `presence`, `light_on`, `fan_on` (state-change log)
  - `/alerts/{id}`: `ts`, `room`, `type`, `message`, `status`
- **Known firmware quirk:** all `ts` / `updated_at` fields are unix **milliseconds**, not seconds as the original spec assumed. The app has been fixed to match this (see below) — firmware was not changed.
- **Known firmware/sensor issue (not fixed, by instruction):** `light_on` / `fan_on` sometimes read `false` and `ldr` reads `0` even when the light/fan are physically on. This is a sensor calibration or wiring issue on the firmware side, confirmed by checking Firebase directly (the wrong values are already wrong at the source, the app just displays them correctly).

## App (`/app`) — Expo + TypeScript

Scaffolded with `npx create-expo-app`, Android package name `com.roomenergy.app`.

**Screens built** (bottom-tab navigation):
1. **Live** — presence badge, temperature, humidity, light/fan status, AC on/off toggle (writes to `/room1/state_user`), raw LDR/vibration readings.
2. **Room** — a user-supplied `room.html` (animated router/ESP32/person view + live rssi_var chart) rendered in a WebView, fed live `/room1/state` + `state_user/ac_on` via `postMessage`. Converted to a TS string with `scripts/generate-room-html.js` (JSON.stringify, so the HTML's own template literals can't break the generated file) -- regenerate after editing `room.html`. Verified the page's badge switches "DEMO / SIMULATED" -> "LIVE" on device. (Several from-scratch Wi-Fi visualizations -- wave animation, silhouette blob, tiered range gauge, line chart, 24h timeline -- were tried and removed in favor of this.)
3. **Alerts** — live list from `/alerts`, "I switched it off" / "Ignore" buttons update alert status, local notification on new alert (see Expo Go caveat below).
4. **Report** — month summary computed from `/room1/events` + bills, low/high waste ranges (not fake precision) per appliance reconciled against the latest **billed** month (not the current calendar month -- no live meter exists), shows AI explanation + plan from `/reports/{yyyy-mm}` if present, labels data "SIMULATED" if `/meta/simulated` is set. Also: **Bill history** (12-month bar chart with a 200-unit slab line + a slab risk meter for the latest billed month) and a **3-month forecast** (projected from the same months last year, adjusted for this year's trend, flagging months trending well above last year).
5. **Setup** — bill entry, appliance wattages, rate per unit (all saved to Firebase `/config` and `/bills`).

**AC-left-on alert** (app-side only, no firmware/sensor involved): `useAcLeftOnWatcher` (mounted once at the app root) watches presence + `state_user/ac_on`, and after `/config/empty_minutes_threshold` minutes (default 1, for demoing) of *continuous* empty-with-AC-on, pushes one `/alerts` entry -- resets if presence goes active or the AC goes off, so it won't spam. Shown via an `AcAlertBanner` overlay on every screen (not tucked into the Alerts tab) since Expo Go can't show OS notifications; its "I turned it off" button sets `ac_on` false, marks the alert "acted", and logs to `/room1/ac_log`. Verified end-to-end on device.

**Data layer:** Firebase JS SDK (Realtime Database only, no Auth), all field names match the firmware exactly, typed in `src/lib/types.ts`.

## EAS (for building a real installable APK later)

- Logged into Expo via an access token (stored locally in `app/.eas-token.env`, gitignored, never committed).
- Project linked: `@zainab87s-team/room-energy` — https://expo.dev/accounts/zainab87s-team/projects/room-energy
- `eas.json` configured with a `preview` profile that builds an APK (not an app bundle) for direct install.
- **APK not built yet** — by instruction, deferred until explicitly asked for.

## Live device testing — bugs found and fixed

Tested on a real Android phone (OPPO/CPH2001) via Expo Go, first over USB/adb, then over a Wi-Fi tunnel, then finally over USB `adb reverse` + local Metro server (most reliable combo — avoided both slow tunnel bandwidth and the laptop's "Public" Wi-Fi firewall profile blocking inbound LAN connections).

1. **Timestamp unit bug:** app assumed `ts`/`updated_at` were unix seconds; firmware actually sends milliseconds. Caused wrong "updated Xs ago" display and 1000x-wrong waste-hour math in the report. Fixed in `src/lib/time.ts` and `src/lib/reportCalc.ts`.
2. **Empty-string env var bug:** `.env` had `EXPO_PUBLIC_FIREBASE_DATABASE_URL=` (empty, not unset). Code used `envVar ?? fallback`, and `??` does not replace an empty string (only `null`/`undefined`), so the empty string silently won and Firebase threw `Cannot parse Firebase url`. Fixed with an `envOr()` helper that treats `""` as unset.
3. **expo-notifications crash in Expo Go on Android:** since Expo SDK 53, Expo Go on Android has no notification support at all (local or push) — merely importing the library throws at module-load time. Wrapped the import in `try/catch` so the rest of the app keeps working in Expo Go; real device notifications will work once built as an actual APK.

## Brain (`/brain`, Python)

Python wasn't installed on the laptop at all -- installed Python 3.12 via the official installer, plus `anthropic`, `firebase-admin`, `python-dotenv`, `openai`, `google-genai` (not the full `requirements.txt` yet, just what's been needed so far).

- **`import_bill.py`**: reads an electricity bill photo, sends it to an LLM (vision) to extract the current bill + 12-month history table, validates the numbers (flags tariff-line/total mismatches), shows a summary, and only writes to Firebase `/bills/{yyyy-mm}` after explicit confirmation. The 14-digit reference number is never written to Firebase and never printed in full (last 4 digits only). Secrets live in `brain/.env` (gitignored) loaded explicitly from that path, not the project root.
  - **Provider history:** brief originally specified Anthropic. User asked for "Grok" but gave a Groq key (`gsk_...`) -- different company, confusing similar names. Groq's free-tier key had no vision-capable model available (its `/models` list was text/audio only). Switched to Google Gemini, which has a free tier, vision, and native PDF support. Model name needed two corrections after the API itself reported deprecations -- ended up on `gemini-3.1-flash-lite` (set via `GEMINI_MODEL` in `.env`, easy to change if it's deprecated later).
  - **Verified end-to-end** against a real 12-month LESCO bill (a Reddit sample, not the user's own) -- all 12 history entries plus the current bill matched the source exactly. Written to Firebase as test data for the app's chart/forecast work; replace with the user's real bill when available.
- Not yet built: `fesco_fetch.py`, `bridge.py`, `calibrate.py`, `classify.py`, `alerts.py`, `report.py`, `accuracy.py`.

## Verified working (as of this log)

- `/room1/state` updates live in the Live tab and the Room WebView.
- `/room1/events` are being logged and are readable; Bill history chart, slab meter, and forecast render from real `/bills` data (seeded via `import_bill.py`).
- Alerts screen live list, buttons, and badges work; a manual test alert appeared instantly (then deleted).
- AC-left-on alert: full loop tested on device -- alert created after the threshold, banner appeared on screen, "I turned it off" correctly flipped `ac_on` to false, marked the alert "acted", and logged to `/room1/ac_log`.
- Room tab WebView: badge switches "DEMO / SIMULATED" -> "LIVE" within moments of opening, confirming live data delivery via `postMessage`.

## Not yet done

- APK build (deferred, on request).
- `brain/report.py` (AI explanation + next-month plan that the Report tab's "AI explanation" card is already wired to read from `/reports/{yyyy-mm}`) -- not started yet, this is the next logical piece since the app side is ready for it.
- `brain/fesco_fetch.py`, `bridge.py`, `calibrate.py`, `classify.py`, `alerts.py`, `accuracy.py` — not started.
- `/sim` simulated month generator — not started.
- Firmware light/fan sensor calibration fix — out of scope for Claude Code per instruction, user to handle.
- Locking down Firebase test-mode rules.
- 3-tester test log (`docs/test-log.md`), accuracy report (`docs/accuracy.md`).
