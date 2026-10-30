import { z } from "zod";
import { authedJson, handleError, jsonError } from "@/lib/api";

const Body = z.object({
  completed: z.boolean(),
  rating: z.number().int().min(1).max(5).optional(),
  wasNew: z.boolean().default(false),
  comment: z.string().max(500).default(""),
});

export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/feedback">) {
  const { id } = await ctx.params;
  const auth = await authedJson(request, Body);
  if ("error" in auth) return auth.error;
  const { supabase, userId, body } = auth;

  try {
    const { data: session } = await supabase
      .from("break_sessions")
      .select("id, status")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (!session) return jsonError("Session not found", 404);

    if (!body.completed) {
      const { error } = await supabase.from("break_sessions").update({ status: "skipped" }).eq("id", id);
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (!body.rating) return jsonError("Rating is required", 400);

    const { error: fbError } = await supabase.from("feedback").upsert(
      { session_id: id, user_id: userId, rating: body.rating, was_new: body.wasNew, comment: body.comment },
      { onConflict: "session_id" },
    );
    if (fbError) throw fbError;

    const { error } = await supabase
      .from("break_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;

    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
