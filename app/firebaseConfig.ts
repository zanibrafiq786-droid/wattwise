// Firebase JS SDK setup for the app (Realtime Database only, no Auth).
// The database URL and web config here are not secret -- access is controlled
// by Realtime Database security rules, not by hiding this file. Still, the
// rules are currently in TEST MODE (open to anyone) and MUST be locked down
// after the hackathon.
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL:
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ??
    "https://wifi-324bd-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
