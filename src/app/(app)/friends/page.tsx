import Link from "next/link";
import { requireProfile } from "@/lib/session";
import { isoAgo } from "@/lib/time";
import { FriendsManager } from "./friends-manager";

type PlanRow = {
  id: string;
  title: string;
  owner: string;
  created_at: string;
  plan_members: { user_id: string; status: string }[];
};

export default async function FriendsPage() {
  const { supabase, userId, profile } = await requireProfile();
  const { data } = await supabase
    .from("group_plans")
    .select("id, title, owner, created_at, plan_members(user_id, status)")
    .gt("created_at", isoAgo(3 * 86_400_000))
    .order("created_at", { ascending: false })
    .limit(20);
  const plans = (data ?? []) as PlanRow[];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">Group plans</h1>
        {plans.length === 0 ? (
          <p className="card text-sm text-muted">
            No plans yet. Get suggestions on the Plan tab and tap &ldquo;Let friends vote&rdquo;.
          </p>
        ) : (
          <ul className="space-y-2">
            {plans.map((p) => {
              const mine = p.plan_members.find((m) => m.user_id === userId);
              const going = p.plan_members.filter((m) => m.status === "going").length;
              return (
                <li key={p.id}>
                  <Link href={`/plans/${p.id}`} className="card flex items-center justify-between gap-3 hover:bg-surface-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.title}</p>
                      <p className="text-xs text-muted">
                        {p.owner === userId ? "You organized" : "You were invited"} · {going}/{p.plan_members.length}{" "}
                        going
                      </p>
                    </div>
                    {mine?.status === "invited" && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                        RSVP
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <FriendsManager myUsername={profile.username} />
    </div>
  );
}
