import { z } from "zod";
import { authedJson, handleError, jsonError } from "@/lib/api";
import type { Suggestion } from "@/lib/types";

const Body = z.object({
  suggestionId: z.string(),
  // Measured on the client with a monotonic clock from opening the planner to tapping "Go".
  decisionMs: z.number().int().min(0).max(60 * 60_000),
});

export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/decide">) {
  const { id } = await ctx.params;
  const auth = await authedJson(request, Body);
  if ("error" in auth) return auth.error;
  const { supabase, userId, body } = auth;

  try {
    const { data: session } = await supabase
      .from("break_sessions")
      .select("suggestions, status")
      .eq("id", id)
      .eq("user_id", userId)
      .single<{ suggestions: Suggestion[]; status: string }>();
    if (!session) return jsonError("Session not found", 404);

    const chosen = session.suggestions.find((s) => s.id === body.suggestionId);
    if (!chosen) return jsonError("That suggestion isn't part of this session", 400);

    const { error } = await supabase
      .from("break_sessions")
      .update({ chosen, decided_at: new Date().toISOString(), decision_ms: body.decisionMs, status: "decided" })
      .eq("id", id);
    if (error) throw error;

    return Response.json({ ok: true, chosen });
  } catch (err) {
    return handleError(err);
  }
}
