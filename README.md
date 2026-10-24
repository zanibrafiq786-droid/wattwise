# WattWise

An AI system that watches one room for presence (Wi-Fi/RSSI sensing on an ESP32), checks whether
the light/fan/AC were left on while nobody's there, and matches the logged waste against a real
electricity bill at month end -- with a phone app (Expo/React Native) for live status, alerts, a
chatbot, and a solar-worth-it estimate. Built for a "Power. Water. Heat." hackathon; see
`CLAUDE.md` for the full brief and `docs/progress.md` for a running log of what was built, in
what order, and every scope tradeoff made along the way.

## Try it

| | |
|---|---|
| **Demo video (45 s)** | [media/WattWise-Demo.mp4](media/WattWise-Demo.mp4) -- open it and press *View raw* to play it in the browser |
| **Android app (APK)** | [Download WattWise APK (version 8)](https://expo.dev/artifacts/eas/-QkqOz0br1JuDz0OV-vI-M_CxAY11MAwt5xDCurx9gQ.apk) |
| **Pitch deck** | [presentation/WattWise-Pitch-Deck.html](presentation/WattWise-Pitch-Deck.html) -- one self-contained file (images, fonts and animations built in): download it and open it in any browser. Arrow keys or click to move, `F` full screen, `A` autoplay |
| **How the AI works** | [docs/ai-features.md](docs/ai-features.md) |

**Installing the APK:** open the link on an Android phone, download, tap the file and choose
*Install* (allow "install unknown apps" if asked). Sign up with any email. Chat, bill scanning
and the solar advisor run on our cloud brain, so they work without any laptop. Live room
readings appear only for the account linked to our ESP32 sensor.

The demo video shows real screen recordings of the app; the gallery photos in the bill-scan
step are blurred for privacy.

## Repo layout

```
/firmware   ESP32 sketch (PlatformIO/Arduino) -- presence + light/fan/temp sensors
/brain      Python: Firebase-mediated AI workers (chat, solar analysis, month-end report)
/app        Expo React Native phone app
/docs       progress.md, test-log.md, accuracy.md, ai-features.md
/presentation  pitch deck: one self-contained HTML file
/media      45 s demo video
/videos     source of the demo video (HyperFrames)
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
write, except `room1` and `alerts`, which stay writable without sign-in because the ESP32 posts
to them directly over Wi-Fi with no login. (The Python brain uses the service account, which
bypasses rules.) This is a minimum, not full security -- anyone could still post fake sensor
data to those two paths, and any signed-in account can read other paths. Give the ESP32 its own
credentials and per-user rules before real use.

### Cloud brain (Vercel) -- chat, bill scan and solar without the laptop

`api/brain.py` runs the same brain code as a Vercel serverless function
(https://wattwise-brain.vercel.app/api/brain). The app writes each request to Firebase as before,
then calls this URL with the user's Firebase sign-in token; the function checks the token,
does the job and writes the result back to Firebase. Deploy with `npx vercel deploy --prod`
from the repo root after setting these Vercel environment variables: `GEMINI_API_KEY`,
`GEMINI_MODEL`, `FIREBASE_DATABASE_URL`, `FIREBASE_SERVICE_ACCOUNT_JSON` (the whole JSON).
The live room sensor doesn't need the laptop either: the ESP32 posts its readings straight to
Firebase over Wi-Fi, so it only needs power (a USB phone charger is enough). The laptop is only
used to run the month-end report (`python brain/report.py`) and `brain/accuracy.py`.

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
