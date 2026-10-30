"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { mapsUrl } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";

export type Member = { user_id: string; status: "invited" | "going" | "declined" };
export type Option = {
  id: string;
  title: string;
  position: number;
  detail: { headline?: string; plan?: string; lat?: number; lng?: number };
};
export type Vote = { option_id: string; user_id: string };

export function PlanRoom({
  plan,
  userId,
  names,
  initialMembers,
  options,
  initialVotes,
}: {
  plan: { id: string; title: string; owner: string };
  userId: string;
  names: Record<string, string>;
  initialMembers: Member[];
  options: Option[];
  initialVotes: Vote[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [votes, setVotes] = useState(initialVotes);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const filter = `plan_id=eq.${plan.id}`;
    const channel = supabase
      .channel(`plan:${plan.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter }, (payload) => {
        if (payload.eventType === "DELETE") {
          const old = payload.old as Partial<Vote>;
          setVotes((v) => v.filter((x) => x.user_id !== old.user_id));
        } else {
          const nv = payload.new as Vote;
          setVotes((v) => [...v.filter((x) => x.user_id !== nv.user_id), nv]);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_members", filter }, (payload) => {
        const m = payload.new as Member;
        if (m?.user_id) setMembers((ms) => [...ms.filter((x) => x.user_id !== m.user_id), m]);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [plan.id]);

  const myVote = votes.find((v) => v.user_id === userId)?.option_id;
  const me = members.find((m) => m.user_id === userId);
  const tally = new Map(options.map((o) => [o.id, votes.filter((v) => v.option_id === o.id).length]));
  const maxVotes = Math.max(0, ...tally.values());
  const leader = maxVotes > 0 ? options.find((o) => tally.get(o.id) === maxVotes) : undefined;
  const isPoll = options.length > 1;

  async function vote(optionId: string) {
    setVotes((v) => [...v.filter((x) => x.user_id !== userId), { option_id: optionId, user_id: userId }]);
    await createClient()
      .from("poll_votes")
      .upsert({ plan_id: plan.id, option_id: optionId, user_id: userId }, { onConflict: "plan_id,user_id" });
    track("poll_vote", { planId: plan.id });
  }

  async function rsvp(status: Member["status"]) {
    setMembers((ms) => ms.map((m) => (m.user_id === userId ? { ...m, status } : m)));
    await createClient().from("plan_members").update({ status }).eq("plan_id", plan.id).eq("user_id", userId);
    track("rsvp", { planId: plan.id, status });
  }

  async function share() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{plan.title}</h1>
          <p className="text-sm text-muted">
            Organized by {plan.owner === userId ? "you" : names[plan.owner]} · updates live
          </p>
        </div>
        <button className="btn-ghost shrink-0" onClick={share}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>

      {me && me.user_id !== plan.owner && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <span className="font-medium">Are you in?</span>
          <div className="flex gap-2">
            <button className="chip" data-on={me.status === "going"} onClick={() => rsvp("going")}>
              I&apos;m in
            </button>
            <button className="chip" data-on={me.status === "declined"} onClick={() => rsvp("declined")}>
              Can&apos;t make it
            </button>
          </div>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="label">{isPoll ? "Vote for one" : "The plan"}</h2>
        {options.map((o) => {
          const count = tally.get(o.id) ?? 0;
          const pct = votes.length ? Math.round((count / votes.length) * 100) : 0;
          const selected = myVote === o.id;
          return (
            <div key={o.id} className={`card relative overflow-hidden ${selected ? "border-accent" : ""}`}>
              {isPoll && (
                <div
                  className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              )}
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{o.title}</p>
                  {o.detail.headline && <p className="text-sm">{o.detail.headline}</p>}
                  {o.detail.plan && <p className="mt-1 text-xs text-muted">{o.detail.plan}</p>}
                  {o.detail.lat !== undefined && o.detail.lng !== undefined && (
                    <a
                      href={mapsUrl(o.detail.lat, o.detail.lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-accent"
                    >
                      Directions
                    </a>
                  )}
                </div>
                {isPoll && (
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button className={selected ? "btn-primary py-1.5" : "btn-ghost py-1.5"} onClick={() => vote(o.id)}>
                      {selected ? "Voted" : "Vote"}
                    </button>
                    <span className="text-xs text-muted">
                      {count} vote{count === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isPoll && leader && (
          <p className="text-sm">
            Leading: <strong>{leader.title}</strong>
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="label">Who&apos;s coming</h2>
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                {m.user_id === userId ? "You" : names[m.user_id] ?? "Friend"}
                {m.user_id === plan.owner && <span className="text-muted"> · organizer</span>}
              </span>
              <span
                className={
                  m.status === "going" ? "text-good" : m.status === "declined" ? "text-muted line-through" : "text-warn"
                }
              >
                {m.status === "going" ? "Going" : m.status === "declined" ? "Can't make it" : "Invited"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
