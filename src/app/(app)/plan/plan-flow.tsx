"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FeedbackForm } from "@/components/feedback-form";
import { InviteDialog } from "@/components/invite-dialog";
import { SuggestionCard } from "@/components/suggestion-card";
import { track } from "@/lib/analytics";
import { mapsUrl } from "@/lib/geo";
import { monotonicNow, wallNow } from "@/lib/time";
import { MOODS, type Mood, type Suggestion } from "@/lib/types";
import { useOrigin } from "@/lib/use-origin";

export type PendingFeedback = { sessionId: string; activityName: string };

const BREAK_OPTIONS = [30, 45, 60, 75, 90];
const MOOD_EMOJI: Record<Mood, string> = {
  hungry: "😋",
  energized: "⚡",
  tired: "😴",
  social: "🫶",
  curious: "🤔",
  stressed: "😮‍💨",
};

type Result = { sessionId: string; suggestions: Suggestion[]; ranker: "claude" | "heuristic"; candidateCount: number };

export function PlanFlow({ firstName, pendingFeedback }: { firstName: string; pendingFeedback: PendingFeedback | null }) {
  const router = useRouter();
  // Decision timer starts when the planner opens (spec: open → decide in < 1 minute).
  const openedAt = useRef<{ iso: string; perf: number } | null>(null);
  const [breakMinutes, setBreakMinutes] = useState(60);
  const [mood, setMood] = useState<Mood | null>(null);
  const { origin, status: locStatus, locate, resetToCampus } = useOrigin();
  const [phase, setPhase] = useState<"setup" | "loading" | "results" | "decided" | "rating">("setup");
  const [result, setResult] = useState<Result | null>(null);
  const [chosen, setChosen] = useState<Suggestion | null>(null);
  const [decisionMs, setDecisionMs] = useState(0);
  const [inviteIds, setInviteIds] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(pendingFeedback);

  useEffect(() => {
    openedAt.current = { iso: new Date().toISOString(), perf: monotonicNow() };
    track("planner_opened");
  }, []);

  async function findBreak() {
    setPhase("loading");
    setError("");
    const res = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ breakMinutes, mood, origin, openedAt: openedAt.current?.iso ?? new Date().toISOString() }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Couldn't load suggestions");
      setPhase("setup");
      return;
    }
    setResult(json);
    setPhase("results");
    track("suggestions_shown", { ranker: json.ranker, count: json.suggestions.length, breakMinutes, mood });
  }

  async function go(s: Suggestion) {
    if (!result || !openedAt.current) return;
    setBusy(true);
    const ms = Math.round(monotonicNow() - openedAt.current.perf);
    const res = await fetch(`/api/sessions/${result.sessionId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId: s.id, decisionMs: ms }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json()).error ?? "Couldn't save your pick");
      return;
    }
    setChosen(s);
    setDecisionMs(ms);
    setDecidedAt(wallNow());
    setPhase("decided");
    track("decided", { decisionMs: ms, rank: s.rank, category: s.category });
  }

  const [decidedAt, setDecidedAt] = useState(0);
  const leaveBy = chosen ? new Date(decidedAt + (chosen.total_minutes - chosen.walk_minutes) * 60_000) : null;
  const spare = chosen ? breakMinutes - chosen.total_minutes : 0;

  return (
    <div className="space-y-5">
      {pending && (
        <FeedbackForm
          sessionId={pending.sessionId}
          activityName={pending.activityName}
          onDone={() => {
            setPending(null);
            router.refresh();
          }}
        />
      )}

      {phase === "setup" && (
        <section className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Hey {firstName}, got a break?</h1>
            <p className="text-muted">Two taps and we&apos;ll find something worth it.</p>
          </div>

          <fieldset>
            <legend className="label">How long is your break?</legend>
            <div className="flex flex-wrap gap-2">
              {BREAK_OPTIONS.map((m) => (
                <button
                  key={m}
                  className="chip"
                  data-on={breakMinutes === m}
                  aria-pressed={breakMinutes === m}
                  onClick={() => setBreakMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">How are you feeling? (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  className="chip capitalize"
                  data-on={mood === m}
                  aria-pressed={mood === m}
                  onClick={() => setMood(mood === m ? null : m)}
                >
                  <span aria-hidden>{MOOD_EMOJI[m]}</span> {m}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Starting from:</span>
            <button className="chip" data-on={locStatus === "campus"} onClick={resetToCampus}>
              Campus center
            </button>
            <button className="chip" data-on={locStatus === "precise"} onClick={locate}>
              {locStatus === "locating" ? "Locating…" : "My location"}
            </button>
            {locStatus === "denied" && <span className="text-warn">Location unavailable — using campus.</span>}
          </div>

          {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
          <button className="btn-primary w-full py-3.5 text-base" onClick={findBreak}>
            Find my break
          </button>
        </section>
      )}

      {phase === "loading" && (
        <section className="space-y-3" aria-busy="true" aria-live="polite">
          <p className="font-medium">Checking what&apos;s open and happening nearby…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </section>
      )}

      {phase === "results" && result && (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Your top picks</h1>
              <p className="text-sm text-muted">
                {breakMinutes}-min break{mood ? ` · feeling ${mood}` : ""} ·{" "}
                {result.ranker === "claude" ? "ranked by Claude" : "quick ranking"}
              </p>
            </div>
            <button className="btn-ghost shrink-0" onClick={() => setPhase("setup")}>
              Change
            </button>
          </div>

          {result.suggestions.length === 0 ? (
            <div className="card text-center">
              <p className="font-medium">Nothing fits that break right now.</p>
              <p className="mt-1 text-sm text-muted">
                Try a longer break, a bigger walking radius in your preferences, or ask Break Buddy for ideas.
              </p>
            </div>
          ) : (
            <>
              {result.suggestions.map((s) => (
                <SuggestionCard key={s.id} s={s} onGo={() => go(s)} busy={busy} highlight={s.rank === 1} />
              ))}
              <button
                className="btn-ghost w-full"
                onClick={() => setInviteIds(result.suggestions.map((s) => s.id))}
              >
                👥 Can&apos;t decide? Let friends vote
              </button>
            </>
          )}
          {error && <p className="text-sm text-bad">{error}</p>}
        </section>
      )}

      {phase === "decided" && chosen && result && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-good-soft p-4 text-good">
            <p className="text-sm font-semibold">Decided in {Math.max(1, Math.round(decisionMs / 1000))}s 🎉</p>
            <h1 className="mt-1 text-2xl font-bold text-text">{chosen.name}</h1>
            {leaveBy && (
              <p className="mt-1 text-sm text-text">
                Leave by <strong>{leaveBy.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong> to
                be back with {spare} min to spare.
              </p>
            )}
          </div>
          <SuggestionCard s={chosen} />
          <div className="grid gap-2 sm:grid-cols-2">
            <a
              className="btn-primary"
              href={mapsUrl(chosen.lat, chosen.lng)}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("directions_opened", { id: chosen.id })}
            >
              🧭 Walking directions
            </a>
            <button className="btn-ghost" onClick={() => setInviteIds([chosen.id])}>
              👥 Bring a friend
            </button>
          </div>
          <button className="btn-ghost w-full" onClick={() => setPhase("rating")}>
            I&apos;m back — rate it
          </button>
        </section>
      )}

      {phase === "rating" && chosen && result && (
        <FeedbackForm
          sessionId={result.sessionId}
          activityName={chosen.name}
          onDone={() => {
            setResult(null);
            setChosen(null);
            openedAt.current = { iso: new Date().toISOString(), perf: monotonicNow() };
            setPhase("setup");
          }}
        />
      )}

      {result && inviteIds && (
        <InviteDialog
          open
          onClose={() => setInviteIds(null)}
          sessionId={result.sessionId}
          suggestionIds={inviteIds}
          title={inviteIds.length > 1 ? `Break plan: vote by ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : `Join me at ${chosen?.name ?? "my break"}`}
        />
      )}
    </div>
  );
}
