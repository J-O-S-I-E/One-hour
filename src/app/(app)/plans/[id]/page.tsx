import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/session";
import { PlanRoom, type Member, type Option, type Vote } from "./plan-room";

export default async function PlanPage(props: PageProps<"/plans/[id]">) {
  const { id } = await props.params;
  const { supabase, userId } = await requireProfile();

  const { data: plan } = await supabase
    .from("group_plans")
    .select("id, title, owner, meet_at")
    .eq("id", id)
    .maybeSingle();
  if (!plan) notFound();

  const [{ data: members }, { data: options }, { data: votes }] = await Promise.all([
    supabase.from("plan_members").select("user_id, status").eq("plan_id", id),
    supabase.from("poll_options").select("id, title, detail, position").eq("plan_id", id).order("position"),
    supabase.from("poll_votes").select("option_id, user_id").eq("plan_id", id),
  ]);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .in("id", (members ?? []).map((m) => m.user_id));
  const names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name || `@${p.username}`]));

  return (
    <PlanRoom
      plan={plan}
      userId={userId}
      names={names}
      initialMembers={(members ?? []) as Member[]}
      options={(options ?? []) as Option[]}
      initialVotes={(votes ?? []) as Vote[]}
    />
  );
}
