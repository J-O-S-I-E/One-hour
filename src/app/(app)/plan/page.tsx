import { requireProfile } from "@/lib/session";
import { isoAgo } from "@/lib/time";
import type { Suggestion } from "@/lib/types";
import { PlanFlow, type PendingFeedback } from "./plan-flow";

export default async function PlanPage() {
  const { supabase, userId, profile } = await requireProfile();

  // Most recent pick the user hasn't rated yet (decided at least 10 minutes ago, within 2 days).
  const { data: pending } = await supabase
    .from("break_sessions")
    .select("id, chosen, decided_at")
    .eq("user_id", userId)
    .eq("status", "decided")
    .lt("decided_at", isoAgo(10 * 60_000))
    .gt("decided_at", isoAgo(2 * 86_400_000))
    .order("decided_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; chosen: Suggestion }>();

  const pendingFeedback: PendingFeedback | null = pending
    ? { sessionId: pending.id, activityName: pending.chosen.name }
    : null;

  return <PlanFlow firstName={profile.display_name.split(" ")[0]} pendingFeedback={pendingFeedback} />;
}
