"use client";

import { createClient } from "./supabase/client";

/** Fire-and-forget product analytics event (instrumentation for the evaluation plan). */
export function track(name: string, props: Record<string, unknown> = {}) {
  const supabase = createClient();
  void supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    return supabase.from("analytics_events").insert({ user_id: data.user.id, name, props });
  });
}
