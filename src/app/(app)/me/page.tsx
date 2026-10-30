import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { CATEGORY_EMOJI, CATEGORY_LABEL, type Suggestion } from "@/lib/types";

type Row = {
  id: string;
  suggested_at: string;
  break_minutes: number;
  status: "suggested" | "decided" | "completed" | "skipped";
  decision_ms: number | null;
  chosen: Suggestion | null;
  feedback: { rating: number } | null;
};

const STATUS_LABEL: Record<Row["status"], string> = {
  suggested: "Browsed",
  decided: "Picked",
  completed: "Done",
  skipped: "Skipped",
};

export default async function MePage() {
  const { supabase, userId, profile } = await requireProfile();
  const { data } = await supabase
    .from("break_sessions")
    .select("id, suggested_at, break_minutes, status, decision_ms, chosen, feedback(rating)")
    .eq("user_id", userId)
    .order("suggested_at", { ascending: false })
    .limit(30);
  const rows = (data ?? []) as unknown as Row[];

  const decided = rows.filter((r) => r.decision_ms !== null);
  const avgDecision = decided.length
    ? Math.round(decided.reduce((a, r) => a + r.decision_ms!, 0) / decided.length / 1000)
    : null;
  const done = rows.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{profile.display_name}</h1>
          <p className="text-sm text-muted">@{profile.username}</p>
        </div>
        <Link href="/onboarding" className="btn-ghost">
          Preferences
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Breaks planned" value={String(rows.length)} />
        <Stat label="Avg time to decide" value={avgDecision === null ? "—" : `${avgDecision}s`} />
        <Stat label="Completed" value={String(done)} />
      </div>

      <section className="space-y-2">
        <h2 className="label">Recent breaks</h2>
        {rows.length === 0 ? (
          <p className="card text-sm text-muted">No breaks yet. Head to Plan to get your first picks.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {r.chosen ? (
                      <>
                        <span aria-hidden>{CATEGORY_EMOJI[r.chosen.category]}</span> {r.chosen.name}
                      </>
                    ) : (
                      "No pick"
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(r.suggested_at).toLocaleString([], {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}{" "}
                    · {r.break_minutes} min
                    {r.chosen && ` · ${CATEGORY_LABEL[r.chosen.category]}`}
                    {r.decision_ms !== null && ` · decided in ${Math.round(r.decision_ms / 1000)}s`}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {r.feedback ? "⭐".repeat(r.feedback.rating) : STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link href="/metrics" className="block text-center text-sm text-muted underline">
        Pilot metrics dashboard
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
