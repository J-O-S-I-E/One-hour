import { z } from "zod";
import { authedJson, handleError } from "@/lib/api";
import { claudeConfigured, heuristicSuggestions, rankWithClaude } from "@/lib/claude";
import { loadPlanningContext } from "@/lib/planning";
import { MOODS, type Suggestion } from "@/lib/types";

const Body = z.object({
  breakMinutes: z.number().int().min(15).max(180),
  mood: z.enum(MOODS).nullable().default(null),
  openedAt: z.iso.datetime(),
  origin: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
});

export async function POST(request: Request) {
  const auth = await authedJson(request, Body);
  if ("error" in auth) return auth.error;
  const { supabase, userId, body } = auth;

  try {
    const ctx = await loadPlanningContext(supabase, userId, {
      breakMinutes: body.breakMinutes,
      mood: body.mood,
      origin: body.origin,
    });

    let suggestions: Suggestion[] = [];
    let ranker: "claude" | "heuristic" = "heuristic";
    if (ctx.candidates.length > 0) {
      if (claudeConfigured()) {
        try {
          suggestions = await rankWithClaude(ctx.candidates, ctx.rankContext);
          ranker = "claude";
        } catch (err) {
          console.warn("Claude ranking failed, using heuristic ranking", err);
        }
      }
      if (ranker === "heuristic") suggestions = heuristicSuggestions(ctx.candidates, body.breakMinutes);
    }

    const { data: session, error } = await supabase
      .from("break_sessions")
      .insert({
        user_id: userId,
        campus_id: ctx.campus.id,
        break_minutes: body.breakMinutes,
        mood: body.mood,
        opened_at: body.openedAt,
        suggestions,
        ranker,
      })
      .select("id")
      .single();
    if (error) throw error;

    return Response.json({ sessionId: session.id, suggestions, ranker, candidateCount: ctx.candidates.length });
  } catch (err) {
    return handleError(err);
  }
}
