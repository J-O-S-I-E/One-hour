"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useOrigin } from "@/lib/use-origin";

type Msg = { role: "user" | "assistant"; content: string };

const STARTERS = [
  "I have 40 minutes and I'm starving. Something cheap?",
  "Anything fun happening right now?",
  "I need to clear my head before an exam.",
  "Write a quick text inviting my friend to join me.",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [streaming, setStreaming] = useState(false);
  const { origin } = useOrigin();
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    track("chat_message_sent", { turn: history.length });

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, breakMinutes, origin }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Break Buddy is unavailable." }));
        setMessages([...history, { role: "assistant", content: err.error }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages([...history, { role: "assistant", content: "Connection lost. Try again." }]);
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Break Buddy</h1>
          <p className="text-sm text-muted">Ask anything about your break. Powered by Claude.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Break
          <select
            className="input w-auto py-1.5"
            value={breakMinutes}
            onChange={(e) => setBreakMinutes(Number(e.target.value))}
          >
            {[30, 45, 60, 75, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 space-y-3" aria-live="polite">
        {messages.length === 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {STARTERS.map((s) => (
              <button key={s} className="card text-left text-sm hover:bg-surface-2" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user" ? "bg-accent text-on-accent" : "border border-border bg-surface"
                }`}
              >
                {m.content || <span className="animate-pulse text-muted">Thinking…</span>}
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-24 flex gap-2"
      >
        <input
          className="input"
          placeholder="e.g. Where can I get coffee and sit for 20 min?"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Message Break Buddy"
          maxLength={4000}
        />
        <button className="btn-primary" disabled={streaming || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
