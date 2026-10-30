import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { authedJson, handleError, jsonError } from "@/lib/api";
import { chatSystemPrompt, claudeConfigured, streamChat } from "@/lib/claude";
import { loadPlanningContext } from "@/lib/planning";
import { MOODS } from "@/lib/types";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
  breakMinutes: z.number().int().min(15).max(180).default(60),
  mood: z.enum(MOODS).nullable().default(null),
  origin: z.object({ lat: z.number(), lng: z.number() }).nullable().default(null),
});

export async function POST(request: Request) {
  const auth = await authedJson(request, Body);
  if ("error" in auth) return auth.error;
  const { supabase, userId, body } = auth;
  if (!claudeConfigured()) return jsonError("Break Buddy needs ANTHROPIC_API_KEY to be set on the server.", 503);
  if (body.messages[0].role !== "user") return jsonError("Conversation must start with a user message", 400);

  let system;
  try {
    const ctx = await loadPlanningContext(supabase, userId, body);
    system = chatSystemPrompt(ctx.rankContext, ctx.candidates);
  } catch (err) {
    return handleError(err);
  }

  const stream = streamChat(system, body.messages);
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode("\n\nSorry, I can't help with that one. Try asking about your break plans."));
        }
      } catch (err) {
        const msg =
          err instanceof Anthropic.RateLimitError
            ? "Break Buddy is busy right now. Try again in a moment."
            : "Break Buddy hit a snag. Try again.";
        console.error(err);
        controller.enqueue(encoder.encode(`\n\n${msg}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
