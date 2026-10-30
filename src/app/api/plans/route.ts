import { z } from "zod";
import { authedJson, handleError, jsonError } from "@/lib/api";
import type { Suggestion } from "@/lib/types";

const Body = z.object({
  title: z.string().min(1).max(120),
  sessionId: z.uuid().nullable().default(null),
  friendIds: z.array(z.uuid()).min(1).max(20),
  meetAt: z.iso.datetime().nullable().default(null),
  // Poll options: when created from a break session these are the suggestion ids;
  // otherwise free-text titles.
  suggestionIds: z.array(z.string()).max(5).default([]),
  customOptions: z.array(z.string().min(1).max(120)).max(5).default([]),
});

export async function POST(request: Request) {
  const auth = await authedJson(request, Body);
  if ("error" in auth) return auth.error;
  const { supabase, userId, body } = auth;

  try {
    let options: { title: string; detail: object }[] = body.customOptions.map((title) => ({ title, detail: {} }));
    if (body.sessionId && body.suggestionIds.length > 0) {
      const { data: session } = await supabase
        .from("break_sessions")
        .select("suggestions")
        .eq("id", body.sessionId)
        .eq("user_id", userId)
        .single<{ suggestions: Suggestion[] }>();
      if (!session) return jsonError("Session not found", 404);
      const picked = session.suggestions.filter((s) => body.suggestionIds.includes(s.id));
      options = [
        ...picked.map((s) => ({
          title: s.name,
          detail: { headline: s.headline, plan: s.plan, lat: s.lat, lng: s.lng, category: s.category },
        })),
        ...options,
      ];
    }
    if (options.length === 0) return jsonError("Add at least one option to vote on", 400);

    const { data: plan, error } = await supabase
      .from("group_plans")
      .insert({ owner: userId, title: body.title, session_id: body.sessionId, meet_at: body.meetAt })
      .select("id")
      .single();
    if (error) throw error;

    const members = [
      { plan_id: plan.id, user_id: userId, status: "going" },
      ...body.friendIds.filter((f) => f !== userId).map((f) => ({ plan_id: plan.id, user_id: f, status: "invited" })),
    ];
    const { error: memberError } = await supabase.from("plan_members").insert(members);
    if (memberError) {
      // RLS rejects non-friends; clean up the half-made plan.
      await supabase.from("group_plans").delete().eq("id", plan.id);
      return jsonError("You can only invite accepted friends.", 403);
    }

    const { error: optionError } = await supabase
      .from("poll_options")
      .insert(options.map((o, i) => ({ plan_id: plan.id, title: o.title, detail: o.detail, position: i })));
    if (optionError) throw optionError;

    return Response.json({ planId: plan.id });
  } catch (err) {
    return handleError(err);
  }
}
