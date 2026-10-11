// ROOM NODE firmware TEMPLATE. The app fills in the values marked with double underscores below. Do not change anything else.
// Board: ESP32 Dev Module (ESP32 DevKit V1, 30-pin). Wi-Fi: 2.4 GHz only.
// Pins: DHT data=GPIO4, MPU6050 SDA=GPIO21 SCL=GPIO22 AD0=GND, LDR divider middle=GPIO34.
#include <WiFi.h>
#include <WiFiUdp.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Preferences.h>
#include "DHT.h"

const char* WIFI_NAME  = "__WIFI_NAME__";
const char* WIFI_PASS  = "__WIFI_PASS__";
const char* DB_URL     = "__DB_URL__";
const char* USER_UID   = "__UID__";
const char* DEVICE_KEY = "__DEVICE_KEY__";
const int EMPTY_SECS = 180;   // seconds without movement before the room is "empty" (use 60 for demos)

DHT dht(4, __DHT_TYPE__);
String BASE;
Preferences prefs;
WiFiUDP udp;
const int MPU = 0x68;
float actThr = 2.0, shiftThr = 2.0, baseMean = 0, baseSd = 1.0;
float fanThr = 0.02, tempOff = 0;
float ldrOff = 500, ldrOn = 3000;
bool calibrated = false, lightState = false, lightInit = false;
float temp = -1, hum = -1, vibAvg = 0, ldrAvg = -1, lastPct = -100;
unsigned long lastActive = 0, lastSend = 0;
uint8_t hist = 0;
String lastPresence = "";
bool lastFan = false, lastLight = false, alerted = false;

int16_t readWord() { int16_t hi = Wire.read(); int16_t lo = Wire.read(); return (hi << 8) | lo; }
float readMag() {
  Wire.beginTransmission(MPU); Wire.write(0x3B); Wire.endTransmission(false);
  Wire.requestFrom(MPU, 6, true);
  float x = readWord() / 16384.0, y = readWord() / 16384.0, z = readWord() / 16384.0;
  return sqrt(x * x + y * y + z * z);
}

bool fbSend(const char* method, String path, String json) {
  if (WiFi.status() != WL_CONNECTED) return false;
  WiFiClientSecure client; client.setInsecure();
  HTTPClient http;
  http.begin(client, String(DB_URL) + path + ".json");
  http.addHeader("Content-Type", "application/json");
  int code = (strcmp(method, "PUT") == 0) ? http.PUT(json) : http.POST(json);
  http.end();
  Serial.printf("Firebase %s -> %d\n", method, code);
  return code == 200;
}

void measureWindow(float &rVar, float &rMean, float &vib, int &ldr) {
  IPAddress gw = WiFi.gatewayIP();
  float rs = 0, rs2 = 0, ms = 0, ms2 = 0; long ls = 0; int mc = 0;
  for (int i = 0; i < 20; i++) {
    udp.beginPacket(gw, 7); udp.write((const uint8_t*)"x", 1); udp.endPacket();
    float r = WiFi.RSSI(); rs += r; rs2 += r * r;
    ls += analogRead(34);
    for (int j = 0; j < 10; j++) { float m = readMag(); ms += m; ms2 += m * m; mc++; delay(8); }
  }
  rMean = rs / 20; rVar = max(0.0f, rs2 / 20 - rMean * rMean);
  float mm = ms / mc; vib = sqrt(max(0.0f, ms2 / mc - mm * mm));
  ldr = ls / 20;
}

void avgVibLdr(int n, float &vAvg, float &lAvg) {
  float sv = 0, sl = 0;
  for (int i = 0; i < n; i++) { float rv, rm, v; int l; measureWindow(rv, rm, v, l); sv += v; sl += l; }
  vAvg = sv / n; lAvg = sl / n;
}

void saveLdr() {
  prefs.putFloat("lo", ldrOff); prefs.putFloat("ln", ldrOn);
  ldrAvg = -1; lightInit = false;
  float d = fabs(ldrOn - ldrOff);
  Serial.printf("LDR range: off=%.0f on=%.0f diff=%.0f\n", ldrOff, ldrOn, d);
  if (d < 300) Serial.println("WARNING: difference is small. Point the LDR at the bulb and shield it from window light.");
  else Serial.println("LIGHT range OK.");
}

void calibLight() {
  Serial.println("LIGHT: turn the light OFF. Measuring in 8 seconds...");
  delay(8000);
  float v, l; avgVibLdr(5, v, l); ldrOff = l;
  Serial.println("Now turn the light ON. Measuring in 8 seconds...");
  delay(8000);
  avgVibLdr(5, v, l); ldrOn = l;
  saveLdr();
}

void calibFan() {
  Serial.println("FAN: turn the fan OFF. Measuring in 8 seconds...");
  delay(8000);
  float vOff, lOff; avgVibLdr(5, vOff, lOff);
  Serial.println("Now turn the fan ON. Measuring in 10 seconds...");
  delay(10000);
  float vOn, lOn; avgVibLdr(5, vOn, lOn);
  Serial.printf("Vibration off=%.4f on=%.4f\n", vOff, vOn);
  if (vOn < vOff * 2 || vOn - vOff < 0.005) { Serial.println("WARNING: small difference. Tape the MPU6050 to the fan body and send 'f' again."); return; }
  fanThr = (vOff + vOn) / 2; prefs.putFloat("ft", fanThr);
  Serial.printf("FAN calibration done. threshold=%.4f\n", fanThr);
}

void calibPresence() {
  Serial.println("PRESENCE 1/2: leave the room. Starting in 20 seconds...");
  delay(20000);
  Serial.println("Measuring the empty room (45 seconds)...");
  float sv = 0, sm = 0, sm2 = 0; int n = 20;
  for (int k = 0; k < n; k++) { float rv, rm, v; int l; measureWindow(rv, rm, v, l); sv += rv; sm += rm; sm2 += rm * rm; }
  float meanV = sv / n; baseMean = sm / n;
  baseSd = sqrt(max(0.0f, sm2 / n - baseMean * baseMean)); if (baseSd < 0.5) baseSd = 0.5;
  actThr = meanV * 3 + 0.5;
  Serial.println("PRESENCE 2/2: come in, sit in your usual spot and do not move. Starting in 15 seconds...");
  delay(15000);
  Serial.println("Measuring while sitting (45 seconds)...");
  float ss = 0;
  for (int k = 0; k < n; k++) { float rv, rm, v; int l; measureWindow(rv, rm, v, l); ss += rm; }
  float sep = fabs(ss / n - baseMean);
  if (sep > 2 * baseSd && sep > 1.5) { shiftThr = sep / 2; Serial.printf("GOOD: sitting differs from empty by %.1f dB (noise %.1f).\n", sep, baseSd); }
  else { shiftThr = max(2.0f, 3 * baseSd); Serial.printf("WARNING: sitting differs only %.1f dB (noise %.1f). Move the ESP32 nearer the line between router and seat and send 'p' again.\n", sep, baseSd); }
  calibrated = true;
  prefs.putFloat("thr", actThr); prefs.putFloat("bm", baseMean); prefs.putFloat("bs", baseSd);
  prefs.putFloat("sh", shiftThr); prefs.putBool("cal", true);
  Serial.println("PRESENCE calibration done.");
}

void calibTemp() {
  Serial.println("TEMP: type the real room temperature from a good thermometer (for example 29.5) and press Enter...");
  Serial.setTimeout(60000);
  float truth = Serial.parseFloat();
  float raw = dht.readTemperature();
  if (truth < 5 || truth > 60 || isnan(raw)) { Serial.println("Temperature calibration skipped."); return; }
  tempOff = truth - raw; prefs.putFloat("to", tempOff);
  Serial.printf("TEMP done. DHT=%.1f real=%.1f offset=%.1f\n", raw, truth, tempOff);
}

void setup() {
  Serial.begin(115200);
  BASE = String("/ingest/") + USER_UID + "/" + DEVICE_KEY;
  pinMode(0, INPUT_PULLUP);
  dht.begin();
  Wire.begin(21, 22);
  Wire.beginTransmission(MPU); Wire.write(0x6B); Wire.write(0); Wire.endTransmission(true);
  prefs.begin("room", false);
  actThr = prefs.getFloat("thr", 2.0); baseMean = prefs.getFloat("bm", 0); baseSd = prefs.getFloat("bs", 1.0);
  shiftThr = prefs.getFloat("sh", 2.0); calibrated = prefs.getBool("cal", false);
  fanThr = prefs.getFloat("ft", 0.02); tempOff = prefs.getFloat("to", 0);
  ldrOff = prefs.getFloat("lo", 500); ldrOn = prefs.getFloat("ln", 3000);
  WiFi.begin(WIFI_NAME, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWi-Fi connected");
  Serial.println("Commands (type a letter and press Enter): l=light guided, 0=light is OFF now, 1=light is ON now, f=fan, p=presence, t=temperature, r=show values");
  delay(2000);
  lastActive = millis();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(1000); }
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'l') calibLight();
    else if (c == '0') { float v, l; avgVibLdr(5, v, l); ldrOff = l; saveLdr(); }
    else if (c == '1') { float v, l; avgVibLdr(5, v, l); ldrOn = l; saveLdr(); }
    else if (c == 'f') calibFan();
    else if (c == 'p') { calibPresence(); lastActive = millis(); }
    else if (c == 't') calibTemp();
    else if (c == 'r') Serial.printf("actThr=%.2f shiftThr=%.2f base=%.1f fanThr=%.4f ldrOff=%.0f ldrOn=%.0f tempOff=%.1f\n", actThr, shiftThr, baseMean, fanThr, ldrOff, ldrOn, tempOff);
  }
  if (digitalRead(0) == LOW) { calibPresence(); lastActive = millis(); }

  float rv, rm, vib; int ldr;
  measureWindow(rv, rm, vib, ldr);

  static unsigned long lastDht = 0;
  if (millis() - lastDht > 10000 || temp < 0) {
    float t = dht.readTemperature(), h = dht.readHumidity();
    if (!isnan(t)) temp = t + tempOff;
    if (!isnan(h)) hum = h;
    lastDht = millis();
  }

  bool active = rv > actThr;
  hist = ((hist << 1) | (active ? 1 : 0)) & 0x1F;
  bool moving = __builtin_popcount(hist) >= 2;
  bool shift = calibrated && fabs(rm - baseMean) > shiftThr;
  if (moving || shift) lastActive = millis();
  unsigned long quiet = (millis() - lastActive) / 1000;
  String presence = moving ? "active" : ((shift || quiet < EMPTY_SECS) ? "quiet" : "empty");

  vibAvg = 0.7 * vibAvg + 0.3 * vib;
  bool fanOn = vibAvg > fanThr;

  if (ldrAvg < 0) ldrAvg = ldr;
  ldrAvg = 0.7 * ldrAvg + 0.3 * ldr;
  float span = ldrOn - ldrOff;
  float pct = fabs(span) < 1 ? 0 : (ldrAvg - ldrOff) / span * 100.0;
  pct = constrain(pct, 0.0f, 100.0f);
  if (!lightInit) { lightState = pct >= 50; lightInit = true; }
  if (pct >= 60) lightState = true;
  if (pct <= 40) lightState = false;
  bool lightOn = lightState;

  Serial.printf("%s | var=%.2f mean=%.1f shift=%d | vib=%.4f | ldr=%d light=%.0f%% | t=%.1f h=%.0f | fan=%d light=%d\n",
                presence.c_str(), rv, rm, shift, vibAvg, ldr, pct, temp, hum, fanOn, lightOn);

  bool changed = (presence != lastPresence) || fanOn != lastFan || lightOn != lastLight;
  bool pctMoved = fabs(pct - lastPct) >= 10 && millis() - lastSend > 3000;
  if (changed || pctMoved || millis() - lastSend > 10000) {
    char buf[520];
    snprintf(buf, sizeof(buf),
      "{\"presence\":\"%s\",\"light_on\":%s,\"light_pct\":%.0f,\"ldr_off\":%.0f,\"ldr_on\":%.0f,\"fan_on\":%s,"
      "\"temp_c\":%.1f,\"humidity\":%.0f,\"ldr\":%d,\"vib\":%.4f,\"rssi_var\":%.2f,\"updated_at\":{\".sv\":\"timestamp\"}}",
      presence.c_str(), lightOn ? "true" : "false", pct, ldrOff, ldrOn, fanOn ? "true" : "false", temp, hum, ldr, vibAvg, rv);
    fbSend("PUT", BASE + "/state", String(buf));
    if (changed) {
      snprintf(buf, sizeof(buf),
        "{\"ts\":{\".sv\":\"timestamp\"},\"presence\":\"%s\",\"light_on\":%s,\"fan_on\":%s}",
        presence.c_str(), lightOn ? "true" : "false", fanOn ? "true" : "false");
      fbSend("POST", BASE + "/events", String(buf));
    }
    lastSend = millis(); lastPresence = presence; lastFan = fanOn; lastLight = lightOn; lastPct = pct;
  }

  if (presence == "empty" && (fanOn || lightOn) && !alerted) {
    String msg = String("Room empty but ") + (fanOn ? "fan " : "") + (lightOn ? "light " : "") + "still on";
    fbSend("POST", BASE + "/alerts", "{\"ts\":{\".sv\":\"timestamp\"},\"type\":\"left_on\",\"message\":\"" + msg + "\",\"status\":\"new\"}");
    alerted = true;
  }
  if (presence == "active") alerted = false;
}
