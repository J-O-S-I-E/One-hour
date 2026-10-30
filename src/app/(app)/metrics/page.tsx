import { evaluate, MIN_SAMPLE_SESSIONS, verdict, type RawMetrics, type Status, type Verdict } from "@/lib/metrics";
import { requireProfile } from "@/lib/session";
import { isoAgo } from "@/lib/time";

const DAY = 86_400_000;

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  "on-target": { label: "On target", cls: "bg-good-soft text-good" },
  watch: { label: "Watch", cls: "bg-warn-soft text-warn" },
  failing: { label: "Anti-signal", cls: "bg-bad-soft text-bad" },
  "no-data": { label: "No data", cls: "bg-surface-2 text-muted" },
};

const VERDICT_COPY: Record<Verdict, { title: string; body: string; cls: string }> = {
  kill: {
    title: "Kill threshold hit",
    body: "Completion <30% or satisfaction <50%. Re-evaluate the recommendation logic before investing further.",
    cls: "bg-bad-soft text-bad",
  },
  iterate: {
    title: "Iterate",
    body: "Above the kill line but not yet at scale thresholds (>60% completion, >80% satisfaction, >50% invites).",
    cls: "bg-warn-soft text-warn",
  },
  scale: {
    title: "Scale",
    body: "All scale thresholds met. Expand to new campuses.",
    cls: "bg-good-soft text-good",
  },
  "insufficient-data": {
    title: "Not enough data yet",
    body: `Decisions are pre-committed but need at least ${MIN_SAMPLE_SESSIONS} sessions with ratings in the window.`,
    cls: "bg-surface-2 text-muted",
  },
};

export default async function MetricsPage() {
  const { supabase } = await requireProfile();
  const { data: claims } = await supabase.auth.getClaims();
  const admins = (process.env.METRICS_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const email = String(claims?.claims.email ?? "").toLowerCase();
  if (admins.length > 0 && !admins.includes(email)) {
    return <p className="card text-sm text-muted">The pilot metrics dashboard is limited to the product team.</p>;
  }

  const windows = [0, 1, 2].map((i) => ({
    p_since: isoAgo((i + 1) * 30 * DAY),
    p_until: isoAgo(i * 30 * DAY),
  }));
  const results = await Promise.all(windows.map((w) => supabase.rpc("get_success_metrics", w)));
  const months = results.map((r) => r.data as RawMetrics | null);
  const current = months[0];
  if (!current) {
    return <p className="card text-sm text-bad">Couldn&apos;t load metrics: {results[0].error?.message}</p>;
  }

  const criteria = evaluate(current);
  const v = verdict(current);
  const graduated = months.every((m) => m && verdict(m) === "scale");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilot metrics</h1>
        <p className="text-sm text-muted">
          Last 30 days · {current.sessions} sessions · {current.active_users} active users ·{" "}
          {current.sessions ? Math.round((current.claude_ranked / current.sessions) * 100) : 0}% ranked by Claude
        </p>
      </div>

      <div className={`rounded-2xl p-4 ${graduated ? "bg-good-soft text-good" : VERDICT_COPY[v].cls}`}>
        <p className="text-lg font-bold">{graduated ? "Graduate" : VERDICT_COPY[v].title}</p>
        <p className="text-sm text-text">
          {graduated ? "Scale thresholds held for 3 consecutive months." : VERDICT_COPY[v].body}
        </p>
      </div>

      <ul className="space-y-3">
        {criteria.map((c) => (
          <li key={c.key} className="card space-y-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{c.label}</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[c.status].cls}`}>
                {STATUS_STYLE[c.status].label}
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">{c.display}</p>
            <p className="text-xs text-muted">{c.definition}</p>
            <p className="text-xs">
              Target {c.target} · Anti-signal {c.antiSignal}
            </p>
          </li>
        ))}
      </ul>

      <section className="space-y-2">
        <h2 className="label">Month over month</h2>
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Window</th>
                <th className="px-4 py-2 font-medium">Sessions</th>
                <th className="px-4 py-2 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {months.map((m, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{i === 0 ? "Last 30 days" : `${i * 30 + 1}–${(i + 1) * 30} days ago`}</td>
                  <td className="px-4 py-2 tabular-nums">{m?.sessions ?? "—"}</td>
                  <td className="px-4 py-2">{m ? VERDICT_COPY[verdict(m)].title : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
