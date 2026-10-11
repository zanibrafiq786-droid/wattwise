# SETUP_WIZARD.md: auth + "Add a device" wizard (read together with CLAUDE.md)

## 0. Safety first
- Create a git branch `multiuser` and commit the current working app before changing anything.
- Keep the old `/room1` data path and the old app flow working until the new system is tested end to end. The demo must not break.
- Do not touch the firmware logic. `firmware/room_node.ino` is a TEMPLATE: the app only replaces placeholders.

## 1. Auth (Firebase Auth, persisted with AsyncStorage)
1. Screens: Welcome, Sign up, Sign in (email + password), Forgot password, Sign out. Loading, empty and error states, polished design.
2. "Continue with Google": implement LAST. It needs an EAS build (not Expo Go), the app SHA-1 in Firebase and a fresh google-services.json. Check the current Expo docs for the right library and tell me step by step what to do in the Firebase console.
3. Signed-out users see only the auth screens.

## 2. Data layout
- `/users/{uid}/...`: bill, config, devices, reports.
- `/users/{uid}/devices/{deviceKey}` = `{ name, dhtType, createdAt }`.
- `/deviceKeys/{uid}/{deviceKey}` = `true` (lets the ESP32 write).
- `/ingest/{uid}/{deviceKey}/state | events | alerts | state_user`: written by the ESP32, read by the app.
- Field names inside state/events/alerts stay exactly: presence, light_on, light_pct, ldr_off, ldr_on, fan_on, temp_c, humidity, ldr, vib, rssi_var, updated_at (ms).
- Migrate all screens to read from the selected device. Add a device picker.

## 3. "Add a device" wizard (plain words for a non-technical user)

### Step 1: What you need
ESP32 DevKit V1 (30-pin), DHT11 or DHT22, MPU6050 module (GY-521), one LDR, one 10k resistor, breadboard, jumper wires, USB cable and a 5V phone adapter. Wi-Fi must be 2.4 GHz. Never touch mains wiring. Everything runs from the USB cable.

### Step 2: Wiring (table plus a simple diagram, exact pins)
| Part | Part pin | ESP32 pin |
|---|---|---|
| Power rails | + rail | 3V3 |
| Power rails | - rail | GND |
| DHT11/DHT22 (3-pin module) | VCC / DATA / GND | 3V3 / **GPIO4** / GND |
| MPU6050 (GY-521) | VCC / GND | 3V3 / GND |
| MPU6050 | SDA / SCL | **GPIO21** / **GPIO22** |
| MPU6050 | AD0 | GND |
| LDR | one leg | 3V3 |
| LDR + 10k resistor | other LDR leg, one 10k leg and a jumper to **GPIO34** all in the SAME breadboard row | GPIO34 |
| 10k resistor | other leg | GND |

Warnings: never connect 5V to GPIO34 or any GPIO. If the board gets hot or the LED turns off, unplug the USB at once and look for a short between 3V3 and GND. If the DHT is a bare 4-pin sensor, add a 10k resistor between VCC and DATA. Keep the MPU6050 wires under 50 cm and tape the sensor to the fan body (never on moving blades). Point the LDR at the bulb and shield it from window light.

### Step 3: Register the device
Ask: room name, DHT type (DHT11 or DHT22), Wi-Fi name (2.4 GHz) and Wi-Fi password.
- The Wi-Fi password is typed on the phone only. NEVER write it to Firebase, logs or analytics.
- Generate `deviceKey` with a secure random source (32 characters, letters and digits).
- Write `/deviceKeys/{uid}/{deviceKey} = true` and `/users/{uid}/devices/{deviceKey}`.

### Step 4: Generate the code, then the user chooses ONE of two install options

**4.0 Generate the code (no code editing by the user)**
1. Load `firmware/room_node.ino` as a bundled asset (generate a TS string constant with a script using JSON.stringify; do not paste it by hand, it contains quotes and `%`).
2. Replace EXACTLY these placeholders and nothing else: `__WIFI_NAME__`, `__WIFI_PASS__`, `__DB_URL__` (database URL from the app's Firebase config, no trailing slash), `__UID__` (signed-in user's uid), `__DEVICE_KEY__` (generated key), `__DHT_TYPE__` (`DHT11` or `DHT22`, no quotes).
3. Escape `\` as `\\` and `"` as `\"` inside the Wi-Fi name and password. Verify that no `__...__` placeholder is left.

**4.1 Show two big option cards**

**Option A: "A technical person will do it for me"**
- A switch before sharing: "Include my Wi-Fi details" (default ON) or "The technician will type the Wi-Fi details" (then substitute the visible text `YOUR_WIFI_NAME` and `YOUR_WIFI_PASSWORD` and add a clear comment on line 1 saying to replace them).
- A warning before sharing: the file contains the Wi-Fi password when included, and the code writes to this user's data, so share it only with someone trusted.
- Button "Share": create two files in the app cache and open the system share sheet (expo-sharing or the React Native Share API; WhatsApp, email, Drive):
  1. `room_node.ino` (the generated code).
  2. `TECHNICIAN_SHEET.txt`: plain text, readable without the app. Contents: a one-line purpose; the parts list; the exact wiring table (DHT data GPIO4; MPU6050 SDA GPIO21, SCL GPIO22, AD0 to GND, VCC to 3V3, GND to GND; LDR 3V3 to LDR to middle point to 10k to GND, middle point to GPIO34); the safety rules (3.3 V only, never 5 V on a GPIO, no mains wiring, unplug at once if the board gets hot); the Arduino IDE steps (board URL, "esp32 by Espressif Systems", library "DHT sensor library" by Adafruit, board "ESP32 Dev Module", COM port, hold BOOT while "Connecting..." shows); the Serial Monitor commands (l, 0, 1, f, p, t, r) and what success looks like ("Wi-Fi connected" at 115200, then lines of readings).
- Also a "Copy code" button.

**Option B: "I'll do it myself"** (guided checklist)
- A progress bar and one short screen per step, each with a "Done" button that unlocks the next, and an expandable "Having trouble?" section:
  1. Install Arduino IDE 2.x (arduino.cc/en/software).
  2. Add ESP32 support: File > Preferences > paste `https://espressif.github.io/arduino-esp32/package_esp32_index.json` (copy button) > Boards Manager > install "esp32 by Espressif Systems".
  3. Install the library: Library Manager > "DHT sensor library" by Adafruit (accept dependencies).
  4. Connect the ESP32 with a DATA USB cable. Tools > Board > ESP32 Dev Module. Tools > Port > the COM port. Trouble: no port = try another cable, install the CH340 or CP2102 driver (check the small black chip near the USB port), check Device Manager > Ports.
  5. Paste the code (Copy code button) into a new sketch and press Upload. When "Connecting..." shows, hold the BOOT button until the percentage starts. Trouble: "Failed to connect" = hold BOOT, lower Upload Speed to 115200, try another USB port.
  6. Open Serial Monitor at 115200. Success = "Wi-Fi connected". Trouble: only dots = wrong Wi-Fi name or password, or a 5 GHz network.
- A link "Stuck? Send this to a technical person" that jumps to Option A.

**4.2 Not now (roadmap only, do NOT build this now):** flashing from a browser (ESP Web Tools / Web Serial) with a prebuilt binary and entering the Wi-Fi details at runtime. Mention it in the pitch as a future improvement.

### Step 5: Calibrate and verify
Show the Serial Monitor commands with plain instructions:
- `l` guided light calibration (light off, then on), or `0` (light is OFF now) and `1` (light is ON now)
- `f` fan (off, then on)
- `p` presence (leave the room, then sit still in your usual spot)
- `t` temperature (type the real temperature)
- `r` show the saved values
Then a "Waiting for your ESP32..." screen that turns green when `/ingest/{uid}/{deviceKey}/state/updated_at` changes. Troubleshooting card: only dots in Serial = wrong Wi-Fi name or password or a 5 GHz network; Firebase code 401/403 = the database rules; board hot = short circuit.

## 4. Database rules (firebase.rules.json)
Test in the Rules Playground and tell me exactly what to click. Do NOT deploy until the new app works end to end with a new account and a real ESP32.
```json
{
  "rules": {
    "users": { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid" } },
    "deviceKeys": { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid" } },
    "ingest": { "$uid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid",
      "$deviceKey": { ".write": "root.child('deviceKeys').child($uid).child($deviceKey).exists()" }
    } }
  }
}
```
Be honest in the docs: anyone who has a device's generated code can write to that one device's data, so the code must not be shared. A production version would use per-device credentials.

## 5. Rules for you (Claude Code)
- Never log or store the Wi-Fi password or the deviceKey.
- Small steps, tell me what to test on my phone after each part.
- Ask me for the Wi-Fi name and password only inside the app flow, never in this chat.
