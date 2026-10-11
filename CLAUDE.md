# PROJECT BRIEF (read fully before writing any code)

## 0. Context and hard deadline
- Hackathon theme: Power. Water. Heat. We chose ONE problem: **electricity bills and usage**.
- **Submission deadline: Monday Oct 12, 7 PM (Pakistan time).** Demo day: Sat Oct 17. No late submissions.
- Judging: working app 30, real problem and user understanding 20, use of AI 20, demo ad 15, pitch deck 15.
- Rule: test with at least 3 real people and record what they said and what we changed.
- **Time is the main risk. Prefer simple things that work over impressive things that don't. Time-box every spike. Tell me when something is taking too long and propose the fallback.**
- I use VS Code on my laptop. I am building the mobile app myself with your help. Explain steps briefly and exactly.

## 1. What we are building (one paragraph)
An AI system that uses ordinary Wi-Fi as a sensor. An ESP32 in ONE room reads Wi-Fi CSI (channel state information) from the home router, and an AI model decides whether the room is **empty / still / active** (or **unsure**). Simple sensors tell whether the **light** is on (LDR), the **fan** is running (MPU6050 vibration), and the room **temperature/humidity** (DHT22). When the room is empty but the fan/light stay on, the user gets an alert. Everything is logged to Firebase. At month end the AI matches the logged waste to the real electricity bill, shows which appliance/habit wasted the most, and gives next month's optimized plan, guiding the user step by step. The AC is app-tapped (no sensor). The app is a phone app (Expo / React Native).

**Scope for the deadline: ONE room, NO current clamp, NO solar, NO multi-room.** Those go in the deck as "next steps".

## 2. Hardware I have (already bought)
ESP32 DevKit V1 **30-pin** (original ESP32, ESP32-WROOM-32), DHT22 module, MPU6050 (GY-521) module, LDR GL5528 x2, 10k resistors, 830-point breadboard, jumper wires, USB cable + 5V adapter. 2.4 GHz Wi-Fi router.
- First thing to ask me: which USB driver chip (CH340/CP2102), my OS, and the exact text on the ESP32 chip.

## 3. Breadboard wiring (tell me this step by step when I build)
Power the ESP32 from USB only. Everything below runs at **3.3 V**. Never connect anything to mains. No mains wiring in this project.

| Part | Part pin | ESP32 pin |
|---|---|---|
| Power rails | + rail | 3V3 |
| Power rails | - rail | GND |
| DHT22 (3-pin module) | VCC / DATA / GND | 3V3 rail / **GPIO4** / GND rail |
| MPU6050 (GY-521) | VCC / GND / SDA / SCL | 3V3 rail / GND rail / **GPIO21** / **GPIO22** |
| MPU6050 | AD0 | GND (I2C address 0x68) |
| LDR divider | 3V3 -> LDR -> middle point -> 10k -> GND; middle point -> **GPIO34** | see below |

- LDR divider: one LDR leg to 3V3 rail, other LDR leg and one 10k leg share a row (the middle point), the other 10k leg to GND rail, and a jumper from the middle row to GPIO34. Brighter light = higher voltage on GPIO34.
- If DHT22 is the bare 4-pin sensor (not a module), add a 10k resistor between VCC and DATA.
- Use **only ADC1 pins (GPIO32-39) for analog** because ADC2 cannot be read while Wi-Fi is on. GPIO34 is input-only, which is fine.
- Keep MPU6050 wires short (30-50 cm if it must sit near the fan; I2C gets unreliable on long wires). If the ESP32 board covers the breadboard, use jumper wires to the power rails.
- Physical placement: ESP32 **3-8 m from the router**, not directly in line with it. MPU6050 fixed with tape on the fan body or stand, never on moving blades. LDR facing the room light.
- Provide an I2C scan sketch, a DHT read sketch and an ADC read sketch to verify each part **before** building anything else.

## 4. Architecture
```
ESP32 (CSI features + LDR + MPU6050 vibration + DHT22)
   | 1 JSON line per second over USB serial (115200 baud)
   v
brain/ (Python on my laptop):  serial bridge -> classifier -> state machine -> alerts
   |  writes to / reads from
   v
Firebase Realtime Database (Spark plan, free; NO Cloud Functions, they need paid Blaze)
   ^
   | live listeners
Phone app (Expo React Native): live room card, alerts, monthly report, plan, calibration
```
Stretch only (do not start until everything else works): ESP32 writes to Firebase directly over Wi-Fi.
Free-plan write limits are small, so write state to Firebase **only on change plus a 10-second heartbeat**, never every second.

### Repo layout
```
/firmware   PlatformIO or ESP-IDF project
/brain      Python: bridge, features, model, alerts, report (LLM)
/app        Expo React Native app
/docs       test-log.md, accuracy.md, deck-notes.md
/sim        simulated one-month data generator (clearly labelled SIMULATED everywhere)
.env.example  (never commit real keys or Wi-Fi passwords)
```

## 5. Firebase Realtime Database structure
```
/room1/state   { presence: "empty|still|active|unsure", confidence: 0-1, light_on: bool,
                 fan_on: bool, ac_on: bool(user tap), temp_c, humidity, updated_at }
/room1/events/{id}   { ts, presence, light_on, fan_on, ac_on }           // state CHANGES only
/alerts/{id}   { ts, room, type, message, wasted_rs_est, status: "new|acted|dismissed" }
/config        { watts: { fan: 75, light: 12, ac: 1500 }, rate_rs_per_unit: 33,
                 empty_minutes_threshold: 5 }     // demo mode: 1 minute
/bills/{yyyy-mm}   { units, amount_rs }
/reports/{yyyy-mm} { waste_by_appliance, text, plan_steps }
/commands/calibrate { mode: "empty|empty_fan|sitting|walking", ts }
```
Use test-mode rules during development and tell me they are insecure and must be tightened or removed after the hackathon.

## 6. Components and exact specs

### 6.1 Firmware (/firmware)
- **Primary plan:** PlatformIO (VS Code) with ESP-IDF, based on Espressif's `esp-csi` example `get-started/csi_recv_router` (the ESP32 connects to the router as a station and pings it so CSI arrives).
- **Do a time-boxed spike (max 90 minutes): confirm CSI packets arrive and amplitude changes when I walk in the room.** If it fails, report and fall back to Plan B.
- **Plan B:** Arduino framework, presence from **RSSI variance** (weaker but works), same JSON output.
- **Plan C:** replay mode in /brain that streams recorded JSON lines (used if hardware misbehaves on demo day).
- Every second print one JSON line, for example:
  `{"t":1712345678,"csi_mad":1.8,"csi_var":4.2,"rssi":-52,"ldr":2310,"vib":0.04,"temp":31.2,"hum":48}`
  where `csi_mad`/`csi_var` are per-second features over subcarrier amplitudes, `vib` is the std dev of acceleration magnitude sampled at about 100 Hz over 1 s, `ldr` is the raw ADC value.
- Wi-Fi SSID/password in an untracked config header.

### 6.2 Brain (/brain, Python)
- `bridge.py`: read serial, parse JSON, handle disconnects, or read from replay file (`--replay file.jsonl`).
- `calibrate.py`: record labelled windows for **empty, empty_with_fan_on, sitting, walking** (60 s each). Save to CSV. Train a scikit-learn model (RandomForest or similar) on window features. Save model with joblib.
- `classify.py`: 20-30 s smoothing (majority vote), **hysteresis**: room becomes "empty" only after N seconds of no activity and returns to "active" after 2-3 activity detections. Output `unsure` when confidence is below a threshold. **Never alert when unsure; instead write a "confirm?" prompt the app can show.**
- Light: threshold from a 2-point calibration (lights off / lights on). Fan: threshold from 20 s fan off + 20 s fan on. Document that the LDR cannot separate daylight from a bulb in the day.
- `alerts.py`: alert when presence == empty for N minutes AND (fan_on OR light_on OR ac_on). Message includes the estimated waste (watts x hours x rate). **Habit learning:** if the user dismisses the same alert pattern repeatedly, lengthen its cooldown; if the user acts on it, keep or shorten it.
- `report.py`: month-end. Inputs: logged events, config watts, bill units/amount. Compute wasted hours and units per appliance, scale against the bill total, give ranges, never fake precision. Then call the LLM (Anthropic API, model `claude-sonnet-5-5`, key from `.env`, **never in the mobile app**) to write the explanation and a step-by-step next-month plan in simple English and Roman Urdu, with the numbers passed in as data. State clearly in the text that these are estimates.
- `accuracy.py`: run labelled trials (empty / sitting / walking, with fan on/off), print accuracy and a confusion matrix, and save to `/docs/accuracy.md`. This becomes a deck slide.

### 6.3 App (/app, Expo React Native, TypeScript ok)
- Run on my phone with Expo Go. Firebase JS SDK with realtime listeners.
- Screens:
  1. **Live**: room card (presence + confidence %, light, fan, AC toggle, temperature), clearly showing "unsure" when it is.
  2. **Alerts**: feed with "I switched it off" / "Ignore" buttons (these update alert status for habit learning).
  3. **Report**: month summary, waste by appliance (bar chart with ranges), bill match, the AI explanation text, and next-month plan chosen by me, shown as a step-by-step checklist.
  4. **Setup**: calibration buttons (writes /commands/calibrate), bill entry (units, amount), watts per appliance, demo-mode toggle (short empty threshold).
- Local notification when a new alert arrives while the app is open. Push notification is a stretch goal.
- Mark any simulated data with a visible "SIMULATED" label.

### 6.4 Simulated month (/sim)
One real month of data does not exist yet. Generate a realistic simulated month of room events (with seeded randomness) so the report can be demonstrated, labelled **SIMULATED** in the app, report and deck. Use real measurements for the live demo only.

## 7. Build order with acceptance gates (do in this order, stop at each gate and confirm with me)
1. **Gate 0:** project scaffold, `.env.example`, Firebase project connected, one test write and read works from Python and from the app.
2. **Gate 1 (sensors):** I2C scan finds 0x68; DHT22, LDR and MPU6050 print sane values over serial.
3. **Gate 2 (CSI spike, max 90 min):** CSI (or Plan B RSSI) values visibly differ between empty room and me walking.
4. **Gate 3:** calibration + classifier gives empty/still/active live in Firebase. Run accuracy.py with at least 20 trials.
5. **Gate 4:** alert fires when I leave with fan on; app shows it; I can mark it acted/dismissed.
6. **Gate 5:** report screen works with the simulated month plus the real bill I enter; LLM explanation and plan appear.
7. **Gate 6 (docs):** fill /docs/test-log.md for 3 testers (what they said, what we changed), /docs/accuracy.md, and a short README so a judge can run it.
8. Only after all gates pass: polish, push notifications, ESP32-to-Firebase direct, extra rooms, solar.

## 8. Rules for Claude Code
- Small steps, run and verify each step, tell me the exact command or wiring action to do.
- If a step is blocked for more than about 30 minutes, stop and propose the fallback (Plan B / Plan C).
- No secrets in git. Use `.env`.
- Be honest in the UI and docs: it is an estimate, presence not people-count, simulated data labelled.
- Safety: this project involves no mains wiring. If I ask about clamp sensors or mains, tell me to use a qualified electrician.
- Keep code simple and commented in plain English. I need to explain it at demo day.

## 9. Things I must provide you before you start
- ESP32 chip text and USB driver chip, my OS.
- Wi-Fi 2.4 GHz SSID/password (go in untracked config).
- Firebase project config (web app config and Realtime Database URL, plus a service account JSON for the Python brain).
- Anthropic API key (for `report.py` only).
- My latest electricity bill: units and amount.
- Router location and the room layout (distance ESP32 to router).

## 10. Test log template (/docs/test-log.md)
For each of 3 testers: name or initials, home type, what they tried, what they said (exact words), what broke or confused them, what we changed, before/after.
