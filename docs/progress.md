# Progress Log

Running log of what's been done, in order. Deadline: Monday Oct 12, 7 PM (Pakistan time) -- **today**.

## Branch note

Everything from "Firebase Auth (multiuser)" onward is on the `multiuser` git branch, not `master`. `master` still has the pre-auth working app as a safe fallback (SETUP_WIZARD.md Section 0's "demo must not break" rule).

## SETUP_WIZARD.md and CHATBOT_SOLAR.md status

Two large new specs arrived mid-build, both bigger than the remaining time before the deadline:
- **SETUP_WIZARD.md**: Step 1 (Auth) is done. Steps 2-5 (multi-user `/users/{uid}/...` data migration, the "Add a device" wizard, Firebase rules) are **not started** -- deprioritized by explicit choice in favor of the items below.
- **CHATBOT_SOLAR.md**: Part A (chatbot) and Part B (solar simulation + AI recommendation + UI) are done, verified end-to-end (see below). Part B's charts and PDF export are **not built**. Part C (satellite shadow mapping, optional per the spec) was **time-boxed to a feasible slice**: real sun-position physics (`brain/solar_geometry.py` -- Erbs GHI decomposition + isotropic-sky transposition, same equations PVsyst uses for this step) applied to the real weather history for the user's lat/lon and their chosen roof direction + tilt angle, replacing the earlier flat-performance-ratio assumption. No satellite imagery, roof detection, or shading -- that needs imagery data not available today; the app's roof-direction picker shows an illustrative (not photographic) diagram, labeled as such.
- **Solar screen usability pass** (user feedback: too technical, raw number inputs, long paragraphs): inputs are now pre-filled from the user's real bill history (AC-afternoon guess from summer/winter bill swing), outage hours use a stepper + plain-word time-of-day chips instead of a 24h hour field (worded "load-shedding", not "outage" -- the English word wasn't understood), advanced/assumption fields are collapsed by default, and the AI's text fields were shortened to one plain sentence each. Results show as icon stat tiles (system size, saving, payback, coverage) and a payback-years comparison chart instead of paragraphs (an earlier version compared raw annual savings, which made the priciest design look best regardless of cost -- switched to payback years, which accounts for cost).
- **Found and fixed while testing this**: `/bills` has a run of corrupted recent months (negative `amount_rs`, from an earlier bad bill-photo re-import) that was zeroing out the whole annual estimate because `bill_profile()` only looked at the last 12 months before filtering bad ones out. Fixed to filter bad entries from the whole history first, so the 5 good months from early-to-mid 2025 are used instead of silently producing a 0 kWh/"none confidence" estimate. The underlying bad rows in Firebase are still there -- user said they'll re-import their real bill themselves.
- A "WattWise v2" visual redesign pack (`Version 2/`, gitignored) also arrived mid-build; its color/font/icon/shape language and a working Cream/Espresso theme toggle were adopted onto the existing screens (not the full multi-room redesign -- see below).

If the deadline arrives before everything is done, what exists is a working single-room app (Auth, Live, Room, Chat, Alerts, Report, Setup) on the `multiuser` branch, plus `master` as an untouched fallback.

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
4. **Report** — month summary computed from `/room1/events` + bills, low/high waste ranges (not fake precision) per appliance reconciled against the latest **billed** month (not the current calendar month -- no live meter exists), shows AI explanation + plan from `/reports/{yyyy-mm}` if present, labels data "SIMULATED" if `/meta/simulated` is set. Also: **Bill history** (12-month bar chart with a 200-unit slab line + a slab risk meter for the latest billed month), a **3-month forecast** (projected from the same months last year, adjusted for this year's trend, flagging months trending well above last year), and an **in-app bill import** card (camera/gallery -> Gemini -> review -> save to `/bills`, same extraction + validation as `brain/import_bill.py`).

   **No AI key in the app (changed before the first APK build):** the photo is written to `/users/{uid}/bill_scans/{id}`; `brain/bill_scan.py` (run by `chat_worker.py`, realtime listener) reads it with the key in `brain/.env`, saves the bill rows, writes the result back and deletes the photo. `EXPO_PUBLIC_GEMINI_*` was removed from `app/.env`. Earlier versions shipped the key in the app bundle by explicit choice; that key was in dev builds only -- rotating it is still a good idea since it was on the phone for a while.
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

## Gate 6 — docs, report.py, accuracy.py

- **`brain/report.py`**: built and verified against real Firebase data. Computes per-appliance waste (same math/ranges as `app/src/lib/reportCalc.ts`) reconciled against the latest *valid* bill (see corrupted-bill note below), asks Gemini (not Anthropic -- no `ANTHROPIC_API_KEY` was ever provided; same provider as everywhere else in `/brain`, documented in the script's own docstring) to write the explanation + next-month plan in English and Roman Urdu, and writes to `/reports/{yyyy-mm}` using the CURRENT calendar month (matching `ReportScreen.tsx`'s lookup key). First real run: correctly flagged "only 0.7 days of data," reconciled against the real 2025-07 bill instead of a corrupted one, bilingual output confirmed.
- **Found and fixed the same corrupted-`/bills` bug here too**: `ReportScreen.tsx` was picking `bills[bills.length-1]` (chronologically last) as "the bill to reconcile against," which is one of the corrupted rows (`2026-10`, Rs 84 for 290 units -- nonsense rate). Added `isValidBill`/`latestValidBill` to `app/src/lib/firebase.ts` (same 5-150 Rs/unit sanity bound used on the Python side) and switched `ReportScreen.tsx` to use it.
- **`brain/accuracy.py`**: built, not run -- needs the real ESP32 physically in the room. This project's presence decision is made by the firmware itself (not a separate trainable Python classifier, which is what the original brief's `calibrate.py`/`classify.py` assumed before the architecture settled on firmware-side presence), so this script tests the real end-to-end system: walks through 20 labelled setups (empty/sitting/walking x fan on/off), reads `/room1/state` after each, and writes a real confusion matrix to `docs/accuracy.md`. `docs/accuracy.md` currently holds a placeholder explaining this, not invented numbers.
- **`docs/test-log.md`**: template created per `CLAUDE.md` section 10's exact format. **Not filled in** -- needs 3 real people actually using the app; nothing fabricated.
- **`README.md`** (project root): judge quickstart -- how to run the app, the brain workers, and the firmware; what's real vs. simulated vs. estimated; known limitations.
- `requirements.txt` was missing `google-genai` and `requests`, both actually required by the existing brain scripts (`chat_worker.py`, `solar_worker.py`, `weather.py`) -- `pip install -r requirements.txt` would not have actually worked for a judge. Fixed.

- **`sim/generate_month.py`**: rewritten per explicit user instruction to never risk real data -- writes ONLY to `/sim/room1/events` and `/sim/meta/simulated` (640 seeded events across 30 days), never to `/room1/events`/`/room1/state`/`/alerts`. Verified live: real `/room1/events` still has its original 126 real events untouched after running it. The app now has a real "Data source" toggle (Setup tab: `app/src/lib/dataSourceContext.tsx`, AsyncStorage-persisted, per-device) that switches the Report tab's `useRoomEvents` between `/room1/events` (real) and `/sim/room1/events` (this), showing a SIMULATED badge whenever the simulated source is selected. Live presence (Live/Room tabs, `useRoomState`) is untouched by this toggle and always reads the real path.

## Mobile QA pass (user asked for a website-style audit list -- mapped to its RN equivalents)

User's list (horizontal scroll, broken links, page titles, meta descriptions, footer links, 404
page, copyright year, broken buttons, image compression, success/error messages, unused
navigation, mobile optimization) is written for a website; this app has no web pages. Applied
what has a real RN equivalent, skipped what doesn't (no footer/copyright exists anywhere in the
app to begin with -- not a bug, just not applicable):

- **Broken buttons / silent failures found and fixed:** `AccountScreen`'s Avatar had a literal
  no-op `onPress={() => {}}` (now removed, `onPress` made optional on `Avatar`); `handleSave`
  (Account), `handleSaveBill`/`handleSaveConfig` (Setup), the AC toggle (`LiveScreen`), and
  `AcAlertBanner`'s two action buttons all called Firebase writes with no `try/catch` -- a failed
  write looked identical to a successful one (or, for the AC toggle, left the UI showing the
  wrong state with no indication anything went wrong). All now show a real error message on
  failure, and the AC toggle rolls back its optimistic state if the write fails.
- **New shared `StatusMessage` component** for the success/error text pattern used above.
- **Horizontal overflow found and fixed:** `BillHistoryChart` used a fixed `Svg width={300}`;
  on a common 360dp-wide Android screen the content area (`screen width - 64px` of card/scroll
  padding) is only ~296px, so the chart was clipping/overflowing by a few pixels. Same latent
  issue in `RangeBarChart` (`width={240}`, fits but with almost no margin). Both switched to
  `width="100%"` with a matching `viewBox`, so they scale to the actual available width instead
  of a hardcoded pixel value.
- **Page title mismatch found and fixed:** `app.json`'s `name` was still `"Room Energy"` (the
  pre-rename placeholder) while every in-app label says `"WattWise"` -- the Android home-screen
  label and Play Store listing title would have shown the wrong name. Fixed, and added a
  `description` field (closest mobile equivalent of a web meta description).
- **"Custom 404 page" equivalent:** there's no concept of an unmatched URL in a screens-based app
  without deep linking configured, but the real risk is the same -- an unhandled render error
  currently crashes the whole app. Added `ErrorBoundary.tsx`, wrapping the whole app in `App.tsx`,
  showing a friendly "Something went wrong" + Try again screen instead.
- **Navigation audit:** every `navigate("...")` call was cross-checked against every defined
  `Screen name="..."` across `RootNavigator`/`MainTabs`/`AuthNavigator` -- no broken links, no
  orphaned/unused screens found.
- **Not done / not applicable:** copyright year (no copyright line exists anywhere to be wrong),
  footer links (no footer exists), meta descriptions (not a web app -- used `app.json`'s
  `description` instead), image compression (the only raster images are build-time app icons, not
  content loaded per-screen -- no compression tool was already available and the benefit here is
  marginal).

## Per-account data (SETUP_WIZARD Step 2, done)

- Each account's bills, config (incl. its own appliance list), and month reports now live under `/users/{uid}/...`; chat and solar already did. The ESP32's paths (`/room1/*`, `/alerts`) are written by the firmware and can't move, so a sensor is linked to one account via `/users/{uid}/device`; other accounts see "no sensor linked" on Home and no alerts, but bills/report/solar/chat work for them.
- `brain/migrate_to_user.py` copied the old shared data into the existing account (Zainab) and linked room1 to it. It only COPIES: the old `/bills`, `/config`, `/reports` are untouched as a backup. The 14 implausible bill rows were not copied, so they're gone from the app without deleting anything.
- Brain side (`chat_context.use_user(uid)`, `report.py --uid`, solar worker) reads only the requesting account's data.
- Firebase rules are still test mode -- per-account paths are what makes per-user rules possible, but they aren't written yet.

## Not yet done

- APK build (deferred, on request).
- `brain/fesco_fetch.py`, `bridge.py`, `calibrate.py`, `classify.py`, `alerts.py` — not started (superseded by the firmware doing presence on-device; see accuracy.py's note above).
- Firmware light/fan sensor calibration fix — out of scope for Claude Code per instruction, user to handle.
- Locking down Firebase test-mode rules.
- Running `brain/accuracy.py` for real (20 live trials) and filling in `docs/test-log.md` (3 real testers) -- both need the user's own real-world actions, can't be done by Claude Code alone.
