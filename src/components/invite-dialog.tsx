"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { useFriendships } from "@/lib/friends";

export function InviteDialog({
  open,
  onClose,
  sessionId,
  suggestionIds,
  title,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  suggestionIds: string[];
  title: string;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const { friendships } = useFriendships();
  const friends = (friendships ?? []).filter((f) => f.status === "accepted");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sessionId, friendIds: selected, suggestionIds }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn't create the plan");
      return;
    }
    track("invite_sent", { invitees: selected.length, options: suggestionIds.length });
    router.push(`/plans/${json.planId}`);
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl border border-border bg-surface p-0 text-text backdrop:bg-black/40"
    >
      <div className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Invite friends</h2>
          <p className="text-sm text-muted">
            {suggestionIds.length > 1
              ? `They'll vote on your ${suggestionIds.length} options in real time.`
              : "They'll get your plan and can RSVP."}
          </p>
        </div>
        {friendships === null ? (
          <p className="text-sm text-muted">Loading friends…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-muted">
            No friends yet.{" "}
            <Link href="/friends" className="font-semibold text-accent">
              Add some
            </Link>{" "}
            by username.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {friends.map(({ friend }) => (
              <li key={friend.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--accent)]"
                    checked={selected.includes(friend.id)}
                    onChange={(e) =>
                      setSelected(e.target.checked ? [...selected, friend.id] : selected.filter((x) => x !== friend.id))
                    }
                  />
                  <span>
                    {friend.display_name} <span className="text-sm text-muted">@{friend.username}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-bad">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy || selected.length === 0} onClick={create}>
            {busy ? "Sending…" : `Invite ${selected.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </dialog>
  );
}
