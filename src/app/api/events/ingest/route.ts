import { jsonError } from "@/lib/api";
import { EVENT_SOURCES } from "@/lib/event-sources";
import { createServiceClient } from "@/lib/supabase/server";
import type { Campus } from "@/lib/types";

// Pulls external events for every campus. Call on a schedule (e.g. Vercel Cron every 15 min)
// with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("Unauthorized", 401);
  }

  const supabase = createServiceClient();
  const { data: campuses, error } = await supabase.from("campuses").select("*");
  if (error) return jsonError(error.message, 500);

  const from = new Date();
  const to = new Date(from.getTime() + 6 * 3600_000);
  const results: Record<string, number | string> = {};

  for (const source of EVENT_SOURCES.filter((s) => s.enabled())) {
    let total = 0;
    try {
      for (const campus of campuses as Campus[]) {
        const events = await source.fetch(campus, from, to);
        if (events.length === 0) continue;
        const { error: upsertError } = await supabase
          .from("events")
          .upsert(events, { onConflict: "source,external_id" });
        if (upsertError) throw upsertError;
        total += events.length;
      }
      results[source.name] = total;
    } catch (err) {
      results[source.name] = `error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Keep the feed lean: drop external events that ended over a day ago.
  await supabase
    .from("events")
    .delete()
    .neq("source", "user")
    .lt("ends_at", new Date(Date.now() - 24 * 3600_000).toISOString());

  return Response.json({ ok: true, ingested: results });
}
