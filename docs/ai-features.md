# How WattWise uses AI

WattWise helps a Pakistani household understand and cut its electricity bill. AI does six jobs
in the app. The numbers always come from real data and fixed maths, and the AI's job is to
**sense, read, explain and advise**. The AI never makes up a number.

---

## The short version (say this in 30 seconds)

> "WattWise uses ordinary home Wi-Fi as a sensor to tell whether a room is empty, sitting or
> walking, without any camera. When the room is empty but the fan or light is still on, it
> alerts you with the rupees being wasted. AI reads a photo of your electricity bill and fills
> in 12 months of history in seconds. An AI assistant answers questions about *your* bill in
> English or Urdu, using only your real data. At month end, AI explains where the money went
> and gives a step-by-step plan for next month. A solar advisor simulates a full year of sun for
> your exact location and explains in plain words how many panels you need. All of it shows
> ranges, not fake exact numbers."

---

## Where AI is used

| # | Feature | What the AI does | Where it runs |
|---|---|---|---|
| 1 | Wi-Fi presence sensing | Turns Wi-Fi signal changes into *empty / sitting / walking*, using a threshold learned for *your* room | ESP32 + phone app |
| 2 | Bill scanner | Reads a photo of the bill and extracts the 12-month history table | Cloud (Vercel) + Gemini vision |
| 3 | AI assistant (chat) | Answers questions about your bill, grounded only in your own data | Cloud (Vercel) + Gemini |
| 4 | Month-end report & plan | Explains where the waste came from and writes a next-month plan | Gemini (report job) |
| 5 | Solar advisor | Picks the best solar option from simulated designs and explains it in plain language, using your region's rules | Cloud (Vercel) + Gemini |
| 6 | Bill estimate | Looks up your area's tariff; our code then works out the bill for any units | Cloud (Vercel) + Gemini, maths in the app |

The language model is **Google Gemini (gemini-3.5-flash-lite)**, with automatic fallback to
another Gemini model if the first is busy.

---

## 1. Wi-Fi as a sensor: is anyone in the room?

**What it does:** An ESP32 board in the room watches how much the home router's Wi-Fi signal
(RSSI) wobbles. A person moving in the room disturbs the signal; an empty room is steady. The app
turns this into **Empty**, **Sitting** or **Walking**. There is no camera and no microphone, so it
is private by design.

**Where the intelligence is:**
- **It learns your room.** Every room and router is different, so a fixed rule failed in our
  real test: the board said "empty" while someone walked around. The app now has a
  **calibration**: you stay out of the room, then walk in it, and the app learns the signal level
  that separates the two for *that* room.
- **It smooths noisy readings.** One quiet reading doesn't mean the room emptied. The app holds
  "someone is here" for a while after the last movement, so a person sitting still isn't
  mistaken for an empty room.
- **It combines sensors:** a light sensor (LDR), fan vibration (MPU6050 accelerometer), and
  temperature/humidity (DHT22), each calibrated with a simple off/on step.

**Why it matters:** Waste happens when nobody is there. Without knowing presence, an app can only
show your total usage; with it, the app can say *"Fan on in an empty room: about Rs X an hour."*

**Honest note:** This version uses Wi-Fi signal strength (RSSI), not the richer CSI data in the
original plan, and a learned threshold rather than a neural network. It senses *presence*, not
how many people are in the room.

---

## 2. Bill scanner: AI reads your bill photo

**What it does:** Take a photo of your FESCO/DISCO bill and the app fills in your bill history:
the current month plus the **12-month history table** printed on the bill, with units and rupees
for each month. This takes about 7 seconds.

**How the AI is used:** Gemini's vision model reads the photo and returns structured data
(month, units, amount). Our code then **checks** it:
- The bill's own month is taken from the history table, because the AI sometimes read the due
  date instead (that once saved a September bill as October).
- Months in the future are rejected.
- Negative or tiny amounts are **kept**, because homes with solar net-metering really do get
  credit bills.
- Account and customer numbers are never extracted.

**Why it matters:** Typing 12 months by hand is the step where people give up. One photo gives
the app a full year of history to compare, chart and forecast.

---

## 3. AI assistant: ask about *your* bill

**What it does:** A chat assistant you can ask things like *"Why was my bill high this month?"*
or *"How do I stay under 200 units?"* It replies in the language you write in (English, Urdu or
Roman Urdu) and suggests three follow-up questions.

**How the AI is used:** Before each answer, the app collects **your own data**: bill history,
the 200-unit slab status, a next-month forecast, the appliances you listed, and the room
sensor's waste log. That data is given to Gemini with strict rules:
- Use **only** this data. Never invent tariffs, prices or numbers.
- If something is missing, say what's missing and ask **one** question.
- Call estimates estimates, and give ranges.
- Suggest one concrete action, not just facts.
- For bill disputes, point to official FESCO/NEPRA channels.

**Why it matters:** A generic chatbot guesses. This one is *grounded*: every number it says
comes from the user's own bills and sensors.

---

## 4. Month-end report: where did the money go, and what next?

**What it does:** On the Report screen, the app shows how much was wasted per appliance (fan,
light) when the room was empty, as a share of the real bill. AI then writes a short
explanation and a **3-5 step plan for next month**, shown as a checklist you can tick off.

**How the AI is used:**
- **The maths is not AI.** Our code adds up the hours each appliance was on in an empty room,
  multiplies by its watts and the rupee rate, and gives a **range** (about ±20%).
- **Gemini only explains it.** It receives those numbers as data and writes the explanation and
  plan. It is told never to change a number and to base the plan on whichever appliance wasted
  the most, not on generic tips.
- The app shows **only the language you chose** (English, or Urdu).

**Why it matters:** People don't act on a chart; they act on *"The fan in the empty bedroom cost
about Rs 300-450 this month. Switch it off when you leave."*

**Honest note:** The report is generated by running `python brain/report.py` (on the laptop)
after the month ends. It isn't on an automatic schedule yet.

---

## 5. Solar advisor: should I get solar?

**What it does:** You answer a few simple questions: Does the AC run in the afternoon? Which way
does the roof face? How many hours of load-shedding? The app has already filled most of them in
from your bills and your phone's location and compass. It then tells you, in plain words, how
many panels you need, whether a battery is worth it, the yearly saving, and the payback time.

**How the AI is used:**
- **Not AI, real physics:** Our code downloads a year of real hourly sunlight for **your exact
  location** (Open-Meteo weather archive), works out the sun on a panel at your roof's direction
  and tilt, and simulates **every hour of a year (8,760 hours)** for several designs: solar
  without battery, solar with battery, and fully off-grid. Unit tests check that energy is
  conserved in this simulation.
- **AI as the advisor:** Gemini compares the simulated designs and recommends **one**, written
  for a homeowner, not an engineer ("about 6 panels, no battery"). It applies the **solar rules
  of your country and city** (from GPS), takes into account big appliances like AC and water
  pumps, and gives a checklist of what to ask an installer.
- It recognises when your bills show you **already have solar** (credit bills) and advises on
  adding to it instead.

**Why it matters:** Solar is the biggest electricity decision a family makes, and most people
only hear from salespeople. This gives an independent first answer based on their own bills and
location.

---

## 6. Bill estimate: "what will my bill be?"

**What it does:** In the Report screen, a dropdown (*Estimate my bill*) lets you type a number of
units (or tap *Last bill* or *Next month's forecast*) and see the charge, broken down line by line:
each slab of units, fuel adjustment, fixed charge and tax.

**How the AI is used:**
- **AI looks up the tariff, once.** Gemini is asked for the household tariff of your electricity
  company/area (slab rates, whether blocks are charged separately or at one slab rate, fixed charge,
  per-unit adjustment, tax percent). Our code checks it is sane (ascending slabs, plausible rates)
  before saving it.
- **The maths is not AI.** The app multiplies and adds those rates itself, so every line adds up and
  any number of units gives an instant answer.
- **Honest about accuracy.** The rates come from the AI's memory and tariffs change often, so the
  screen shows the date the figures are from, the AI's own confidence, the result as a **range**, and
  a check against your last real bill (*"this tariff gives Rs X; your bill said Rs Y"*).

## Smart alerts (AI output in action)

When the room has been **empty** for a few minutes but the **fan, light or AC is still on**, the
app sends a phone notification (*"Room empty but fan still on"*; for the AC it also says about
how many rupees an hour it costs). The Home screen shows the live cost too: *"Nobody here: Rs X an
hour, Rs Y so far"*. You tap **"I switched it off"** or **"Ignore"**. Those taps are saved so that, in a next version, the app can learn which
alerts you care about.

---

## How we keep the AI honest

- **AI never invents numbers.** All rupees, units and hours come from bills, sensors and fixed
  maths. AI only reads, explains and recommends.
- **Ranges, not fake precision.** Waste, savings and payback are always shown as a range, and
  labelled as estimates.
- **Simulated data is labelled.** The demo month is clearly marked SIMULATED everywhere.
- **Privacy:** Wi-Fi sensing uses no camera or microphone. Bill scans drop the photo after
  reading and never store account numbers.
- **No AI key in the app.** The Gemini key lives only on our cloud server (Vercel). The phone
  proves who it is with its Firebase sign-in, so nobody can pull the key out of the APK.

---

## How it runs (no laptop needed)

```
ESP32 in the room ── Wi-Fi ──► Firebase (live state, events, alerts)
                                   ▲        │
                                   │        ▼
Phone app ── request ──► Firebase ──► Vercel cloud brain ──► Gemini
   ▲                                   │
   └──────── result via Firebase ◄─────┘
```

- The ESP32 only needs power (a phone charger), and sends its readings straight to Firebase.
- Chat, bill scanning and solar run on **Vercel**, so they work with the laptop switched off.

---

## Next steps

- **Habit learning:** use the saved "switched off / ignore" taps to adjust how often each alert
  appears.
- Run the month-end report automatically on a schedule instead of by hand.
- Richer Wi-Fi sensing (CSI) and a trained model for more reliable presence.
- Per-device security credentials for the ESP32.
- More rooms, and a clamp meter (installed by a qualified electrician) for real power readings.
