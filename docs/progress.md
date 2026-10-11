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
1. **Live** — presence badge, temperature, humidity, light/fan status, AC on/off toggle (writes to `/room1/state_user`), and a **Wi-Fi sensing** card showing `rssi_var` (signal variance used for presence detection) plus raw LDR/vibration readings.
2. **Alerts** — live list from `/alerts`, "I switched it off" / "Ignore" buttons update alert status, local notification on new alert.
3. **Report** — month summary computed from `/room1/events` + bill, low/high waste ranges (not fake precision) per appliance, shows AI explanation + plan from `/reports/{yyyy-mm}` if present, labels data "SIMULATED" if `/meta/simulated` is set.
4. **Setup** — bill entry, appliance wattages, rate per unit (all saved to Firebase `/config` and `/bills`).

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

## Verified working (as of this log)

- `/room1/state` updates live in the Live tab.
- `/room1/events` are being logged and are readable.
- Pushed a manual test alert to `/alerts` — it appeared in the Alerts tab instantly (then deleted the test entry).
- Alerts screen buttons and badges render correctly.

## Not yet done

- APK build (deferred, on request).
- `/brain` (Python: bridge, calibrate, classify, alerts, report, accuracy) — not started.
- `/sim` simulated month generator — not started.
- Firmware light/fan sensor calibration fix — out of scope for Claude Code per instruction, user to handle.
- Locking down Firebase test-mode rules.
- 3-tester test log (`docs/test-log.md`), accuracy report (`docs/accuracy.md`).
