import { CATEGORY_EMOJI, CATEGORY_LABEL, type Suggestion } from "@/lib/types";

const PRICE = ["Free", "$", "$$", "$$$"];

export function SuggestionCard({
  s,
  onGo,
  busy,
  highlight,
}: {
  s: Suggestion;
  onGo?: () => void;
  busy?: boolean;
  highlight?: boolean;
}) {
  return (
    <article className={`card space-y-3 ${highlight ? "border-accent" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">
            <span aria-hidden>{CATEGORY_EMOJI[s.category]}</span> {CATEGORY_LABEL[s.category]} · {s.name}
          </p>
          <h3 className="mt-0.5 text-lg leading-snug font-semibold">{s.headline}</h3>
        </div>
        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">#{s.rank}</span>
      </div>
      <p className="text-sm">{s.reason}</p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge>🚶 {s.walk_minutes} min</Badge>
        <Badge>⏱ {s.total_minutes} min total</Badge>
        <Badge>{PRICE[s.price_level]}</Badge>
        {s.is_popup && <Badge tone="accent">Pop-up</Badge>}
        {s.ends_in_minutes !== null && s.ends_in_minutes < 90 && (
          <Badge tone="warn">Ends in {s.ends_in_minutes} min</Badge>
        )}
        {!s.tried_before && <Badge tone="good">New to you</Badge>}
      </div>
      <p className="text-xs text-muted">{s.plan}</p>
      {onGo && (
        <button className="btn-primary w-full" onClick={onGo} disabled={busy}>
          Let&apos;s go
        </button>
      )}
    </article>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "accent" | "good" | "warn" }) {
  const cls =
    tone === "accent"
      ? "bg-accent-soft text-accent-strong"
      : tone === "good"
        ? "bg-good-soft text-good"
        : tone === "warn"
          ? "bg-warn-soft text-warn"
          : "bg-surface-2 text-muted";
  return <span className={`rounded-full px-2 py-0.5 font-medium ${cls}`}>{children}</span>;
}
