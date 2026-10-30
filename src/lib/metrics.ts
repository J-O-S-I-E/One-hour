// Success criteria and kill/scale/graduate thresholds from the product spec.

export type RawMetrics = {
  sessions: number;
  active_users: number;
  decided: number;
  decided_under_60s: number;
  decided_over_120s: number;
  median_decision_ms: number | null;
  completed: number;
  feedback_count: number;
  positive_feedback: number;
  avg_rating: number | null;
  new_discoveries: number;
  users_sent_invites: number;
  claude_ranked: number;
};

export type Status = "on-target" | "watch" | "failing" | "no-data";

export type Criterion = {
  key: string;
  label: string;
  definition: string;
  value: number | null; // ratio 0..1
  display: string;
  target: string;
  antiSignal: string;
  status: Status;
};

const ratio = (n: number, d: number) => (d > 0 ? n / d : null);
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)}%`);

function grade(value: number | null, target: number, fail: number): Status {
  if (value === null) return "no-data";
  if (value > target) return "on-target";
  if (value < fail) return "failing";
  return "watch";
}

export function evaluate(m: RawMetrics): Criterion[] {
  const under60 = ratio(m.decided_under_60s, m.decided);
  const over120 = ratio(m.decided_over_120s, m.decided);
  const completion = ratio(m.completed, m.decided);
  const satisfaction = ratio(m.positive_feedback, m.feedback_count);
  const invites = ratio(m.users_sent_invites, m.active_users);
  const discovery = ratio(m.new_discoveries, m.active_users);
  const medianS = m.median_decision_ms === null ? null : m.median_decision_ms / 1000;

  // Time to decision: target is 70% deciding in <1 min; failing if the median exceeds 2 min.
  let decisionStatus: Status = "no-data";
  if (under60 !== null && medianS !== null) {
    decisionStatus = medianS > 120 ? "failing" : under60 >= 0.7 ? "on-target" : "watch";
  }

  return [
    {
      key: "decision",
      label: "Time to decision",
      definition: "Share of decisions made within 60 s of opening the planner",
      value: under60,
      display: `${pct(under60)} · median ${medianS === null ? "—" : `${Math.round(medianS)}s`}`,
      target: "≥70% under 1 min",
      antiSignal: `Median >2 min (now ${pct(over120)} of decisions >2 min)`,
      status: decisionStatus,
    },
    {
      key: "completion",
      label: "Activity completion",
      definition: "Decided breaks the student confirmed doing",
      value: completion,
      display: pct(completion),
      target: ">60%",
      antiSignal: "<30%",
      status: grade(completion, 0.6, 0.3),
    },
    {
      key: "satisfaction",
      label: "User satisfaction",
      definition: "Post-activity ratings of 4–5 stars",
      value: satisfaction,
      display: `${pct(satisfaction)}${m.avg_rating ? ` · avg ${m.avg_rating.toFixed(1)}★` : ""}`,
      target: ">80% positive",
      antiSignal: "<50% positive",
      status: grade(satisfaction, 0.8, 0.5),
    },
    {
      key: "invites",
      label: "Social invites sent",
      definition: "Active users who invited at least one friend",
      value: invites,
      display: pct(invites),
      target: ">50% of users",
      antiSignal: "<20%",
      status: grade(invites, 0.5, 0.2),
    },
    {
      key: "discovery",
      label: "New activity discovery",
      definition: "Active users who tried something for the first time",
      value: discovery,
      display: pct(discovery),
      target: ">30% of users",
      antiSignal: "<10%",
      status: grade(discovery, 0.3, 0.1),
    },
  ];
}

export type Verdict = "kill" | "iterate" | "scale" | "insufficient-data";

export const MIN_SAMPLE_SESSIONS = 30;

export function verdict(m: RawMetrics): Verdict {
  if (m.sessions < MIN_SAMPLE_SESSIONS || m.decided === 0 || m.feedback_count === 0) return "insufficient-data";
  const completion = m.completed / m.decided;
  const satisfaction = m.positive_feedback / m.feedback_count;
  const invites = m.active_users ? m.users_sent_invites / m.active_users : 0;
  if (completion < 0.3 || satisfaction < 0.5) return "kill";
  if (completion > 0.6 && satisfaction > 0.8 && invites > 0.5) return "scale";
  return "iterate";
}
