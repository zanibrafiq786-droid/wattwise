import { auth } from "../../firebaseConfig";

// The AI brain runs on Vercel (api/brain.py), so chat, bill scanning and
// solar work even when the laptop is off. The app still writes each request
// to Firebase as before; this just tells the cloud brain "there's a new job
// with this id". The result arrives through the Firebase listener the
// screen already has. The user's sign-in token proves who is asking, so no
// secret key is needed in the app.
const BRAIN_URL = process.env.EXPO_PUBLIC_BRAIN_URL || "https://wattwise-brain.vercel.app";

export function runInCloud(job: "chat" | "scan" | "solar", id: string) {
  const user = auth.currentUser;
  if (!user) return;
  user
    .getIdToken()
    .then((token) =>
      fetch(`${BRAIN_URL}/api/brain`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job, id }),
      })
    )
    .catch(() => {
      // Ignore: if the cloud call fails, the laptop worker (if running)
      // still picks the request up from Firebase.
    });
}
