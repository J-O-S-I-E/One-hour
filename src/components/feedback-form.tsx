"use client";

import { useState } from "react";

export function FeedbackForm({
  sessionId,
  activityName,
  onDone,
}: {
  sessionId: string;
  activityName: string;
  onDone: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [wasNew, setWasNew] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(completed: boolean) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/sessions/${sessionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(completed ? { completed, rating, wasNew, comment } : { completed }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Couldn't save that");
      return;
    }
    onDone();
  }

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold">How was {activityName}?</h2>
        <p className="text-sm text-muted">Your rating tunes future suggestions.</p>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className={`text-3xl transition-transform hover:scale-110 ${n <= rating ? "" : "opacity-25 grayscale"}`}
          >
            ⭐
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wasNew} onChange={(e) => setWasNew(e.target.checked)} className="size-4 accent-[var(--accent)]" />
        First time trying this
      </label>
      <textarea
        className="input min-h-20"
        placeholder="Anything we should know? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />
      {error && <p className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy || rating === 0} onClick={() => send(true)}>
          Submit
        </button>
        <button className="btn-ghost" disabled={busy} onClick={() => send(false)}>
          I didn&apos;t end up going
        </button>
      </div>
    </div>
  );
}
