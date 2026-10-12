// CHATBOT_SOLAR.md Part A: chat transport through Firebase, no server.
// The app only ever writes requests and reads replies under its own
// uid -- the AI call itself happens in the cloud brain (api/brain.py on
// Vercel) or brain/chat_worker.py on the laptop; the model API key lives
// only there.
import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "../../firebaseConfig";
import { runInCloud } from "./cloudBrain";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  ts: number;
  suggestions?: string[];
  status?: "ok" | "error";
}

interface ChatRequest {
  text: string;
  ts: number;
  lang: string;
}

interface ChatReply {
  text: string;
  suggestions?: string[];
  ts: number;
  status: "ok" | "error";
}

export function sendChatMessage(uid: string, text: string, lang: string): string {
  const reqRef = push(ref(db, `/users/${uid}/chat/requests`));
  const id = reqRef.key!;
  set(reqRef, { text, ts: Date.now(), lang } satisfies ChatRequest).then(() => runInCloud("chat", id));
  return id;
}

export function clearChat(uid: string) {
  return remove(ref(db, `/users/${uid}/chat`));
}

// Merges /users/{uid}/chat/requests and .../replies into one time-sorted
// message list for the UI, and separately reports which request ids are
// still waiting on a reply (for the typing indicator / offline timeout).
export function useChatMessages(uid: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    const requestsRef = ref(db, `/users/${uid}/chat/requests`);
    const repliesRef = ref(db, `/users/${uid}/chat/replies`);

    let requests: Record<string, ChatRequest> = {};
    let replies: Record<string, ChatReply> = {};

    // Each reply is placed directly after ITS request (replies are keyed by
    // request id), not sorted by timestamp: request ts comes from the
    // phone's clock and reply ts from the laptop's, and any skew between the
    // two clocks used to put an answer above its question -- which also made
    // the follow-up suggestions show at the wrong moment.
    function rebuild() {
      const reqIds = Object.keys(requests).sort(
        (a, b) => requests[a].ts - requests[b].ts || a.localeCompare(b)
      );
      const list: ChatMessage[] = [];
      for (const id of reqIds) {
        const r = requests[id];
        list.push({ id, role: "user", text: r.text, ts: r.ts });
        const rep = replies[id];
        if (rep) {
          list.push({
            id: id + "-reply",
            role: "assistant",
            text: rep.text,
            ts: rep.ts,
            suggestions: rep.suggestions,
            status: rep.status,
          });
        }
      }
      setMessages(list);

      const last = reqIds[reqIds.length - 1];
      setPendingRequestId(last && !(last in replies) ? last : null);
    }

    const unsubReq = onValue(requestsRef, (snap) => {
      requests = (snap.val() as Record<string, ChatRequest>) ?? {};
      rebuild();
    });
    const unsubRep = onValue(repliesRef, (snap) => {
      replies = (snap.val() as Record<string, ChatReply>) ?? {};
      rebuild();
    });

    return () => {
      unsubReq();
      unsubRep();
    };
  }, [uid]);

  return { messages, pendingRequestId };
}

// Shows a "the assistant is offline" state if a request has been pending
// too long with no reply (CHATBOT_SOLAR.md A1). 60 s, not 25 s: on this
// network a real reply measured 30-40 s, so 25 s flagged a working
// assistant as offline right before its answer arrived.
export function usePendingTimeout(pendingRequestId: string | null, timeoutMs = 60000) {
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTimedOut(false);
    if (pendingRequestId) {
      timerRef.current = setTimeout(() => setTimedOut(true), timeoutMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingRequestId, timeoutMs]);

  return timedOut;
}
