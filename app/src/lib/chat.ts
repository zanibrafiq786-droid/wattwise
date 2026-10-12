// CHATBOT_SOLAR.md Part A: chat transport through Firebase, no server.
// The app only ever writes requests and reads replies under its own
// uid -- the AI call itself happens in brain/chat_worker.py on the laptop,
// which is the only place the model API key lives.
import { useEffect, useRef, useState } from "react";
import { onValue, push, ref, remove, set } from "firebase/database";
import { db } from "../../firebaseConfig";

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
  set(reqRef, { text, ts: Date.now(), lang } satisfies ChatRequest);
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

    function rebuild() {
      const list: ChatMessage[] = [];
      for (const [id, r] of Object.entries(requests)) {
        list.push({ id, role: "user", text: r.text, ts: r.ts });
      }
      for (const [id, r] of Object.entries(replies)) {
        list.push({ id: id + "-reply", role: "assistant", text: r.text, ts: r.ts, suggestions: r.suggestions, status: r.status });
      }
      list.sort((a, b) => a.ts - b.ts);
      setMessages(list);

      const unanswered = Object.keys(requests)
        .filter((id) => !(id in replies))
        .sort((a, b) => requests[a].ts - requests[b].ts);
      setPendingRequestId(unanswered[unanswered.length - 1] ?? null);
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
// for more than 25 seconds with no reply (CHATBOT_SOLAR.md A1).
export function usePendingTimeout(pendingRequestId: string | null, timeoutMs = 25000) {
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
