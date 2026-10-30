"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import { useFriendships } from "@/lib/friends";
import { createClient } from "@/lib/supabase/client";

export function FriendsManager({ myUsername }: { myUsername: string | null }) {
  const { friendships, reload } = useFriendships();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();
    const handle = username.trim().replace(/^@/, "").toLowerCase();
    const { data: target } = await supabase.from("profiles").select("id").eq("username", handle).maybeSingle();
    const { data: auth } = await supabase.auth.getUser();
    if (!target) setMessage({ tone: "bad", text: `No one with username @${handle}.` });
    else if (target.id === auth.user?.id) setMessage({ tone: "bad", text: "That's you!" });
    else {
      const { error } = await supabase.from("friendships").insert({ requester: auth.user!.id, addressee: target.id });
      if (error) setMessage({ tone: "bad", text: error.code === "23505" ? "Request already sent." : error.message });
      else {
        setMessage({ tone: "good", text: `Request sent to @${handle}.` });
        setUsername("");
        track("friend_request_sent");
        await reload();
      }
    }
    setBusy(false);
  }

  async function accept(id: string) {
    await createClient().from("friendships").update({ status: "accepted" }).eq("id", id);
    track("friend_request_accepted");
    await reload();
  }

  async function remove(id: string) {
    await createClient().from("friendships").delete().eq("id", id);
    await reload();
  }

  const incoming = (friendships ?? []).filter((f) => f.status === "pending" && f.incoming);
  const outgoing = (friendships ?? []).filter((f) => f.status === "pending" && !f.incoming);
  const friends = (friendships ?? []).filter((f) => f.status === "accepted");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Friends</h2>
        {myUsername && <p className="text-sm text-muted">Your username: @{myUsername}</p>}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <input
          className="input"
          placeholder="Add by username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          aria-label="Friend's username"
          required
        />
        <button className="btn-primary shrink-0" disabled={busy}>
          Add
        </button>
      </form>
      {message && <p className={`text-sm ${message.tone === "good" ? "text-good" : "text-bad"}`}>{message.text}</p>}

      {incoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="label">Requests</h3>
          {incoming.map((f) => (
            <div key={f.id} className="card flex items-center justify-between gap-3">
              <span>
                {f.friend.display_name} <span className="text-sm text-muted">@{f.friend.username}</span>
              </span>
              <div className="flex gap-2">
                <button className="btn-primary py-1.5" onClick={() => accept(f.id)}>
                  Accept
                </button>
                <button className="btn-ghost py-1.5" onClick={() => remove(f.id)}>
                  Ignore
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="label">Your friends</h3>
        {friendships === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted">No friends yet — breaks are better together.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span>
                  {f.friend.display_name} <span className="text-sm text-muted">@{f.friend.username}</span>
                </span>
                <button className="text-sm text-muted hover:text-bad" onClick={() => remove(f.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {outgoing.length > 0 && (
          <p className="text-sm text-muted">Pending: {outgoing.map((f) => `@${f.friend.username}`).join(", ")}</p>
        )}
      </div>
    </section>
  );
}
