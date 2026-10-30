"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "./supabase/client";

export type FriendProfile = { id: string; username: string | null; display_name: string };
export type Friendship = {
  id: string;
  status: "pending" | "accepted";
  incoming: boolean;
  friend: FriendProfile;
};

export function useFriendships() {
  const [friendships, setFriendships] = useState<Friendship[] | null>(null);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const me = auth.user?.id;
    if (!me) return;
    const { data: rows } = await supabase.from("friendships").select("id, requester, addressee, status");
    const otherIds = (rows ?? []).map((r) => (r.requester === me ? r.addressee : r.requester));
    const { data: profiles } = otherIds.length
      ? await supabase.from("profiles").select("id, username, display_name").in("id", otherIds)
      : { data: [] as FriendProfile[] };
    const byId = new Map((profiles ?? []).map((p) => [p.id, p as FriendProfile]));
    setFriendships(
      (rows ?? []).flatMap((r) => {
        const otherId = r.requester === me ? r.addressee : r.requester;
        const friend = byId.get(otherId);
        return friend ? [{ id: r.id, status: r.status, incoming: r.addressee === me, friend }] : [];
      }),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
  }, [reload]);

  return { friendships, reload };
}
