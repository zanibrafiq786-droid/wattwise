// A small hand-rolled i18n layer (no extra dependency -- disk space on this
// laptop is tight). English/Urdu text only, layout stays left-to-right for
// safety (full RTL mirroring across every screen is a much bigger, riskier
// change this close to the deadline) -- Urdu renders correctly in its own
// script, just not mirrored.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export type Language = "en" | "ur";

const LANGUAGE_STORAGE_KEY = "room-energy:language";

const translations = {
  en: {
    appName: "WattWise",
    appTaglineShort: "Bijli Bachao",
    appTagline: "See which appliances waste electricity while the room is empty, and what it's costing you.",
    signUp: "Sign up",
    signIn: "Sign in",
    createAccount: "Create an account",
    fullName: "Full name",
    hello: "Hello, {name} 👋",
    email: "Email",
    password: "Password",
    alreadyHaveAccount: "Already have an account? Sign in",
    dontHaveAccount: "Don't have an account? Sign up",
    forgotPassword: "Forgot password?",
    resetPassword: "Reset password",
    sendResetLink: "Send reset link",
    resetSent: "If an account exists for {email}, a reset link has been sent. Check your inbox.",
    backToSignIn: "Back to sign in",
    resetDescription: "We'll email you a link to reset your password.",
    enterEmailPassword: "Enter an email and password.",
    enterEmail: "Enter your email.",
    creating: "Creating...",
    signingIn: "Signing in...",
    sending: "Sending...",
    tabLive: "Live",
    tabRoom: "Room",
    tabAlerts: "Alerts",
    tabReport: "Report",
    tabSetup: "Setup",
    tabChat: "Chat",
    account: "Account",
    yourDetails: "Your details",
    saveDetails: "Save details",
    detailsSaved: "Saved.",
    signOut: "Sign out",
    language: "Language",
    appearance: "Appearance",
    cream: "Cream",
    espresso: "Espresso",

    // Live screen
    room1: "Room 1",
    presenceActive: "Active",
    presenceQuiet: "Quiet",
    presenceEmpty: "Empty",
    updatedAgo: "Updated {time}",
    temperature: "Temperature",
    humidity: "Humidity",
    light: "Light",
    fan: "Fan",
    on: "On",
    off: "Off",
    ac: "AC",
    acToggleHint: "Tap to tell the app the AC is on (no sensor)",
    lightSensorRaw: "Light sensor (raw)",
    seeRoomTabHint: "See the Room tab for the live Wi-Fi motion view and signal chart.",
    ldrReading: "LDR reading",
    vibration: "Vibration",
    noSensorData: "No data from the sensor yet. Make sure the ESP32 is powered on and connected.",

    // Alerts screen
    alerts: "Alerts",
    noAlertsYet: "No alerts yet. You'll see one here if a room is left empty with the fan, light or AC on.",
    switchedOff: "I switched it off",
    ignore: "Ignore",
    statusNew: "New",
    statusActed: "Acted",
    statusDismissed: "Dismissed",
    estimatedWaste: "Estimated waste",

    // Report screen
    report: "Report",
    billHistory: "Bill history",
    reconcileTitle: "Reconcile: waste vs. bill",
    aiExplanationTitle: "AI explanation & next-month plan",
    forecastTitle: "Next 3 months (forecast)",
    importBillTitle: "Import bill from photo",
    camera: "Camera",
    gallery: "Gallery",
    saveToFirebase: "Save to Firebase",
    cancel: "Cancel",
    tryAgain: "Try again",
    importAnother: "Import another",

    // Setup screen
    setup: "Setup",
    electricityBill: "Electricity bill",
    unitsKwh: "Units (kWh)",
    amountRs: "Amount (Rs)",
    saveBill: "Save bill",
    applianceWattageRate: "Appliance wattage & rate",
    fanWatts: "Fan (W)",
    lightWatts: "Light (W)",
    acWatts: "AC (W)",
    rateRsPerUnit: "Rate (Rs per unit)",
    saveSettings: "Save settings",

    // Chat screen
    chatTitle: "Ask about your bill",
    chatPlaceholder: "Ask a question...",
    chatSend: "Send",
    chatClear: "Clear chat",
    chatOffline: "Assistant is offline -- start the brain on the laptop (python chat_worker.py).",
    chatThinking: "Thinking...",
    chatEmpty: "Ask anything about your bill, usage, or what's wasting electricity.",
    chatSuggestion1: "Why is my bill high this month?",
    chatSuggestion2: "How far am I from 200 units?",
    chatSuggestion3: "Which habit wastes the most?",
    chatSuggestion4: "What will next month's bill be?",

    // Solar screen
    tabSolar: "Solar",
    solarTitle: "Should I get solar?",
    solarIntro:
      "An estimate from your bill history and local sun data -- not an engineering design or a vendor quote.",
    solarLocation: "Location (lat, lon)",
    solarDaytimeShare: "Daytime usage share (8am-5pm), %",
    solarAcAfternoon: "AC runs in the afternoon",
    solarOutageHours: "Outage hours per day",
    solarOutageStart: "Outage usually starts at (hour, 0-23)",
    solarCostPerKw: "Cost per kW (panels + inverter), Rs — ASSUMPTION",
    solarCostPerKwhBattery: "Cost per kWh battery, Rs — ASSUMPTION",
    solarExportRate: "Export rate, Rs/unit (0 if none) — ASSUMPTION",
    solarRunAnalysis: "Run AI analysis",
    solarRunning: "Running the analysis (this fetches weather data and simulates a year, hour by hour)...",
    solarLowConfidence: "Based on fewer than 12 months of real bills -- lower confidence.",
    solarRecommendation: "Recommendation",
    solarTradeoffs: "Trade-offs",
    solarWhatCouldChange: "What could change this",
    solarVendorChecklist: "Vendor checklist",
    solarCandidates: "Designs compared",
    solarError: "Something went wrong running the analysis. Try again.",
    solarEmpty: "Enter your assumptions and tap \"Run AI analysis\" to get a recommendation.",
  },
  ur: {
    appName: "WattWise",
    appTaglineShort: "بجلی بچاؤ",
    appTagline: "دیکھیں کمرہ خالی ہونے پر کون سا آلہ بجلی ضائع کر رہا ہے، اور اس کی لاگت کتنی ہے۔",
    signUp: "سائن اپ",
    signIn: "سائن ان",
    createAccount: "اکاؤنٹ بنائیں",
    fullName: "پورا نام",
    hello: "ہیلو، {name} 👋",
    email: "ای میل",
    password: "پاسورڈ",
    alreadyHaveAccount: "پہلے سے اکاؤنٹ ہے؟ سائن ان کریں",
    dontHaveAccount: "اکاؤنٹ نہیں ہے؟ سائن اپ کریں",
    forgotPassword: "پاسورڈ بھول گئے؟",
    resetPassword: "پاسورڈ دوبارہ ترتیب دیں",
    sendResetLink: "ری سیٹ لنک بھیجیں",
    resetSent: "اگر {email} کے لیے اکاؤنٹ موجود ہے، تو ری سیٹ لنک بھیج دیا گیا ہے۔ اپنا ان باکس چیک کریں۔",
    backToSignIn: "سائن ان پر واپس جائیں",
    resetDescription: "ہم آپ کو پاسورڈ دوبارہ ترتیب دینے کا لنک ای میل کریں گے۔",
    enterEmailPassword: "ای میل اور پاسورڈ درج کریں۔",
    enterEmail: "اپنا ای میل درج کریں۔",
    creating: "اکاؤنٹ بن رہا ہے...",
    signingIn: "سائن ان ہو رہا ہے...",
    sending: "بھیجا جا رہا ہے...",
    tabLive: "لائیو",
    tabRoom: "کمرہ",
    tabAlerts: "الرٹس",
    tabReport: "رپورٹ",
    tabSetup: "سیٹ اپ",
    tabChat: "چیٹ",
    account: "اکاؤنٹ",
    yourDetails: "آپ کی تفصیلات",
    saveDetails: "تفصیلات محفوظ کریں",
    detailsSaved: "محفوظ ہو گیا۔",
    signOut: "سائن آؤٹ",
    language: "زبان",
    appearance: "ظاہری شکل",
    cream: "کریم",
    espresso: "اسپریسو",

    // Live screen
    room1: "کمرہ 1",
    presenceActive: "متحرک",
    presenceQuiet: "خاموش",
    presenceEmpty: "خالی",
    updatedAgo: "{time} پہلے اپڈیٹ ہوا",
    temperature: "درجہ حرارت",
    humidity: "نمی",
    light: "لائٹ",
    fan: "پنکھا",
    on: "آن",
    off: "آف",
    ac: "اے سی",
    acToggleHint: "ایپ کو بتانے کے لیے دبائیں کہ اے سی آن ہے (کوئی سینسر نہیں)",
    lightSensorRaw: "لائٹ سینسر (خام)",
    seeRoomTabHint: "لائیو وائی فائی موشن ویو اور سگنل چارٹ کے لیے روم ٹیب دیکھیں۔",
    ldrReading: "ایل ڈی آر ریڈنگ",
    vibration: "ارتعاش",
    noSensorData: "ابھی تک سینسر سے کوئی ڈیٹا نہیں۔ یقینی بنائیں کہ ESP32 آن اور منسلک ہے۔",

    // Alerts screen
    alerts: "الرٹس",
    noAlertsYet: "ابھی تک کوئی الرٹ نہیں۔ اگر کمرہ خالی ہو اور پنکھا، لائٹ یا اے سی آن رہ جائے تو یہاں دکھے گا۔",
    switchedOff: "میں نے بند کر دیا",
    ignore: "نظر انداز کریں",
    statusNew: "نیا",
    statusActed: "عمل ہو گیا",
    statusDismissed: "مسترد",
    estimatedWaste: "تخمینی ضیاع",

    // Report screen
    report: "رپورٹ",
    billHistory: "بل کی تاریخ",
    reconcileTitle: "تصدیق: ضیاع بمقابلہ بل",
    aiExplanationTitle: "اے آئی وضاحت اور اگلے مہینے کا منصوبہ",
    forecastTitle: "اگلے 3 مہینے (تخمینہ)",
    importBillTitle: "تصویر سے بل درآمد کریں",
    camera: "کیمرہ",
    gallery: "گیلری",
    saveToFirebase: "فائربیس میں محفوظ کریں",
    cancel: "منسوخ کریں",
    tryAgain: "دوبارہ کوشش کریں",
    importAnother: "ایک اور درآمد کریں",

    // Setup screen
    setup: "سیٹ اپ",
    electricityBill: "بجلی کا بل",
    unitsKwh: "یونٹس (kWh)",
    amountRs: "رقم (روپے)",
    saveBill: "بل محفوظ کریں",
    applianceWattageRate: "آلات کی واٹج اور ریٹ",
    fanWatts: "پنکھا (واٹ)",
    lightWatts: "لائٹ (واٹ)",
    acWatts: "اے سی (واٹ)",
    rateRsPerUnit: "ریٹ (روپے فی یونٹ)",
    saveSettings: "ترتیبات محفوظ کریں",

    // Chat screen
    chatTitle: "اپنے بل کے بارے میں پوچھیں",
    chatPlaceholder: "سوال لکھیں...",
    chatSend: "بھیجیں",
    chatClear: "چیٹ صاف کریں",
    chatOffline: "اسسٹنٹ آف لائن ہے -- لیپ ٹاپ پر برین چلائیں (python chat_worker.py)۔",
    chatThinking: "سوچ رہا ہے...",
    chatEmpty: "اپنے بل، استعمال، یا بجلی کے ضیاع کے بارے میں کچھ بھی پوچھیں۔",
    chatSuggestion1: "اس مہینے بل زیادہ کیوں ہے؟",
    chatSuggestion2: "200 یونٹس سے میں کتنا دور ہوں؟",
    chatSuggestion3: "کون سی عادت سب سے زیادہ ضائع کرتی ہے؟",
    chatSuggestion4: "اگلے مہینے بل کیا ہوگا؟",

    // Solar screen
    tabSolar: "سولر",
    solarTitle: "کیا مجھے سولر لگوانا چاہیے؟",
    solarIntro: "آپ کے بل اور مقامی دھوپ کے ڈیٹا سے ایک تخمینہ -- کوئی انجینئرنگ ڈیزائن یا وینڈر قیمت نہیں۔",
    solarLocation: "مقام (lat, lon)",
    solarDaytimeShare: "دن کے استعمال کا حصہ (8am-5pm)، %",
    solarAcAfternoon: "دوپہر میں اے سی چلتا ہے",
    solarOutageHours: "روزانہ لوڈشیڈنگ کے گھنٹے",
    solarOutageStart: "لوڈشیڈنگ عام طور پر کس وقت شروع ہوتی ہے (گھنٹہ، 0-23)",
    solarCostPerKw: "فی kW لاگت (پینل + انورٹر)، روپے — اندازہ",
    solarCostPerKwhBattery: "فی kWh بیٹری لاگت، روپے — اندازہ",
    solarExportRate: "ایکسپورٹ ریٹ، روپے فی یونٹ (نہ ہو تو 0) — اندازہ",
    solarRunAnalysis: "اے آئی تجزیہ چلائیں",
    solarRunning: "تجزیہ چل رہا ہے (موسمی ڈیٹا اور پورے سال کی سیمولیشن)...",
    solarLowConfidence: "12 مہینے سے کم اصل بلوں پر مبنی -- کم اعتماد۔",
    solarRecommendation: "تجویز",
    solarTradeoffs: "سمجھوتے",
    solarWhatCouldChange: "کیا چیز جواب بدل سکتی ہے",
    solarVendorChecklist: "وینڈر چیک لسٹ",
    solarCandidates: "موازنہ کردہ ڈیزائنز",
    solarError: "تجزیہ چلانے میں مسئلہ ہوا۔ دوبارہ کوشش کریں۔",
    solarEmpty: "اپنے اندازے درج کریں اور \"اے آئی تجزیہ چلائیں\" دبائیں۔",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((saved) => {
      if (saved === "en" || saved === "ur") setLanguageState(saved);
    });
  }, []);

  function setLanguage(lang: Language) {
    setLanguageState(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
  }

  function t(key: TranslationKey, vars?: Record<string, string>): string {
    let text: string = translations[language][key] ?? translations.en[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        text = text.replace(`{${k}}`, v);
      }
    }
    return text;
  }

  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
