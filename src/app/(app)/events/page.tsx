import { requireProfile } from "@/lib/session";
import type { Campus, CampusEvent } from "@/lib/types";
import { EventFeed } from "./event-feed";

export default async function EventsPage() {
  const { supabase, userId, profile } = await requireProfile();
  const now = new Date();
  const [{ data: campus }, { data: events }] = await Promise.all([
    supabase.from("campuses").select("*").eq("id", profile.campus_id!).single<Campus>(),
    supabase
      .from("events")
      .select("*")
      .eq("campus_id", profile.campus_id!)
      .gt("ends_at", now.toISOString())
      .lt("starts_at", new Date(now.getTime() + 12 * 3600_000).toISOString())
      .order("starts_at"),
  ]);

  return <EventFeed campus={campus!} initialEvents={(events ?? []) as CampusEvent[]} userId={userId} />;
}
