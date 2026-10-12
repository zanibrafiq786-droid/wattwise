// Firebase JS SDK setup for the app (Realtime Database only, no Auth).
// The database URL and web config here are not secret -- access is controlled
// by Realtime Database security rules, not by hiding this file. Still, the
// rules are currently in TEST MODE (open to anyone) and MUST be locked down
// after the hackathon.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
// @ts-expect-error -- getReactNativePersistence exists in the RN build of
// firebase/auth (resolved via Metro's "react-native" package export
// condition) but isn't in the TypeScript types for the generic entry point.
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// .env may define these keys as empty strings (not just leave them unset),
// and "" ?? fallback keeps "" since empty string isn't null/undefined -- so
// an empty-string env var silently wins over the fallback. Treat "" as unset.
function envOr<T>(value: string | undefined, fallback: T): string | T {
  return value && value.length > 0 ? value : fallback;
}

const firebaseConfig = {
  apiKey: envOr(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, undefined),
  authDomain: envOr(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, undefined),
  databaseURL: envOr(
    process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    "https://wifi-324bd-default-rtdb.asia-southeast1.firebasedatabase.app"
  ),
  projectId: envOr(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, undefined),
  storageBucket: envOr(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, undefined),
  messagingSenderId: envOr(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, undefined),
  appId: envOr(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, undefined),
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
