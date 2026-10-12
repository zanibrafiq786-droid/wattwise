# WattWise

An AI system that watches one room for presence (Wi-Fi/RSSI sensing on an ESP32), checks whether
the light/fan/AC were left on while nobody's there, and matches the logged waste against a real
electricity bill at month end -- with a phone app (Expo/React Native) for live status, alerts, a
chatbot, and a solar-worth-it estimate. Built for a "Power. Water. Heat." hackathon; see
`CLAUDE.md` for the full brief and `docs/progress.md` for a running log of what was built, in
what order, and every scope tradeoff made along the way.

## Repo layout

```
/firmware   ESP32 sketch (PlatformIO/Arduino) -- presence + light/fan/temp sensors
/brain      Python: Firebase-mediated AI workers (chat, solar analysis, month-end report)
/app        Expo React Native phone app
/docs       progress.md, test-log.md, accuracy.md
/sim        simulated-month data generator (clearly labelled SIMULATED everywhere it's used)
```

## Running it (judge quickstart)

You need: Node.js, Python 3.11+, and a phone with Expo Go installed (or an Android emulator).
The ESP32 hardware is optional to see the app working -- without it, screens just show "no data
yet" until something writes to Firebase.

**1. App**
```
cd app
npm install
cp .env.example .env      # fill in a Firebase project's web config (see below)
npx expo start
```
Scan the QR code with Expo Go, or press `a` for an Android emulator.

**2. Brain (Python workers -- needed for Chat, Solar, and the month-end AI report)**
```
cd brain
pip install -r requirements.txt
cp .env.example .env      # fill in Firebase service account + a free Gemini key
python chat_worker.py     # runs Part A (chat) and Part B (solar) together
python report.py          # generates this month's AI waste report once
```

**3. Firmware (optional -- only needed for live sensor data)**
Open `firmware/` in PlatformIO, copy `firmware/include/secrets.h.example` to `secrets.h` with
your own Wi-Fi credentials, flash an ESP32 wired per `CLAUDE.md` section 3.

### Firebase project

Create a free Realtime Database project at the Firebase console. The app needs the web app
config (`app/.env`); the brain workers need a service account JSON (`brain/serviceAccountKey.json`,
download from Project Settings > Service Accounts) and the database URL (`brain/.env`).
Paste `database.rules.json` into Realtime Database > Rules: only signed-in users can read or
write (the Python brain uses the service account, which bypasses rules). This is a minimum,
not full per-user security -- any signed-in account can still read other paths. Tighten to
per-user rules before real use.

## What's real vs. simulated vs. estimated

- Presence, light/fan state, and temperature come from the real ESP32 sensors when the firmware
  is running; the app clearly shows "no data" otherwise, never a fake live value.
- The month-end waste report and the AI chat answers only ever use real numbers already computed
  from logged events/bills -- the AI is only ever asked to *explain* a number, never invent one.
  Every waste figure is shown as a range (low-high), not a single exact number, because it's a
  presence/on-off-based estimate, not a real power meter reading.
- The Report tab's 12-month history/forecast can include a `/sim`-generated simulated month,
  always labeled **SIMULATED** in the UI, the report text, and the deck -- used only because one
  real month of data doesn't exist yet to demo the report feature end-to-end.
- The Solar tab is an estimate from real weather data (Open-Meteo, for the exact lat/lon the
  phone's GPS reports) and real sun-angle physics for the roof direction/tilt you pick -- not a
  satellite roof survey or a vendor quote. It says so on the screen.

## Known limitations (see `docs/progress.md` for the full list and why)

- Single room, no current-clamp meter, no multi-room support -- scoped out of this deadline by
  design (see `CLAUDE.md` section 1).
- Multi-user data migration and Firebase security rules (`SETUP_WIZARD.md` Steps 2-5) are not
  built; the app works as a single-household demo.
- `docs/test-log.md` and `docs/accuracy.md` need real people and real sensor trials to fill in --
  see those files for the template and what's still needed; nothing in them is fabricated.
