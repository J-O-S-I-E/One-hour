import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Candidate, Mood, Profile, Suggestion } from "./types";

export const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if a request is declined, the API retries it on
// Anthropic's recommended fallback model inside the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient() {
  // Ranking sits on the critical path of a <1 minute decision, so fail fast and fall back.
  client ??= new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return client;
}

export type FeedbackNote = { name: string; category: string; rating: number; comment: string };

export type RankContext = {
  profile: Profile;
  breakMinutes: number;
  mood: Mood | null;
  localTime: string;
  recentFeedback: FeedbackNote[];
};

const RANK_SYSTEM = `You are the recommendation engine for One-Hour Break Planner, an app that helps college students in cities use a short break between classes well.

You receive the student's preferences, their mood, the break length, recent feedback on past picks, and a list of candidate activities that already fit inside the break (walk time, time on site and the return trip are pre-computed and must not be changed).

Pick the 3 best candidates for this student right now, best first. Good picks:
- match the stated mood and interests, and respect budget and dietary needs;
- use the break well without cutting it close;
- give at least one option the student hasn't tried before, and favor time-limited pop-ups or events when they fit, since those are easy to miss;
- avoid categories or places the student recently rated poorly, and lean toward what they rated highly;
- offer some variety, unless the mood clearly points one way (e.g. "hungry").

For each pick write:
- headline: a punchy pitch under 60 characters that names the key fact (e.g. "Free tacos, 4 min walk, ends soon").
- reason: one sentence on why it suits this student right now, referring to their mood, preferences or feedback.
- plan: a one-line timeline using the given minutes, e.g. "Walk 4 min · 25 min there · back with 6 min to spare".

Only use candidate_id values from the list. Write in a friendly, direct voice; no emojis.`;

const RankSchema = z.object({
  picks: z.array(
    z.object({
      candidate_id: z.string(),
      headline: z.string(),
      reason: z.string(),
      plan: z.string(),
    }),
  ),
});

function compactCandidate(c: Candidate) {
  return {
    candidate_id: c.id,
    name: c.name,
    kind: c.kind,
    category: c.category,
    description: c.description,
    walk_minutes_each_way: c.walk_minutes,
    minutes_on_site: c.activity_minutes,
    total_minutes: c.total_minutes,
    price_level: c.price_level,
    tags: c.tags,
    pop_up: c.is_popup,
    event_ends_in_minutes: c.ends_in_minutes,
    tried_before: c.tried_before,
  };
}

function studentContext(ctx: RankContext) {
  const { profile } = ctx;
  return {
    break_minutes: ctx.breakMinutes,
    local_time: ctx.localTime,
    mood: ctx.mood ?? "not given",
    interests: profile.interests,
    budget_level_0_to_3: profile.budget,
    dietary: profile.dietary,
    max_walk_minutes: profile.max_walk_minutes,
    recent_feedback: ctx.recentFeedback,
  };
}

/** Fallback ranking when Claude is unavailable: top heuristic scores with templated copy. */
export function heuristicSuggestions(candidates: Candidate[], breakMinutes: number): Suggestion[] {
  return candidates.slice(0, 3).map((c, i) => ({
    ...c,
    rank: i + 1,
    headline: `${c.name} · ${c.walk_minutes} min walk`,
    reason: c.is_popup
      ? "A pop-up that fits your break — these don't stick around."
      : c.tried_before
        ? "A reliable pick that fits your break."
        : "Something new that fits your break.",
    plan: planLine(c, breakMinutes),
  }));
}

export function planLine(c: Candidate, breakMinutes: number) {
  const spare = breakMinutes - c.total_minutes;
  return `Walk ${c.walk_minutes} min · ${c.activity_minutes} min there · back with ${spare} min to spare`;
}

export async function rankWithClaude(candidates: Candidate[], ctx: RankContext): Promise<Suggestion[]> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    // Speed matters more than depth here: the user is waiting to decide.
    output_config: { effort: "low", format: betaZodOutputFormat(RankSchema) },
    system: RANK_SYSTEM,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          student: studentContext(ctx),
          candidates: candidates.map(compactCandidate),
        }),
      },
    ],
  });

  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new Error(`Claude ranking unavailable (stop_reason=${response.stop_reason})`);
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const picks: Suggestion[] = [];
  for (const p of response.parsed_output.picks) {
    const c = byId.get(p.candidate_id);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    picks.push({ ...c, rank: picks.length + 1, headline: p.headline, reason: p.reason, plan: p.plan });
    if (picks.length === 3) break;
  }
  // Top up from the heuristic order if Claude returned fewer than 3 valid picks.
  for (const s of heuristicSuggestions(candidates.filter((c) => !seen.has(c.id)), ctx.breakMinutes)) {
    if (picks.length === 3) break;
    picks.push({ ...s, rank: picks.length + 1 });
  }
  return picks;
}

// ---------------------------------------------------------------------------
// Break Buddy chat
// ---------------------------------------------------------------------------

const CHAT_SYSTEM = `You are Break Buddy, the assistant inside One-Hour Break Planner. You help a college student decide what to do with a short break between classes, fast.

Ground every recommendation in the "nearby options" list you're given: those are real places and events that fit the student's break, with walking and time-on-site minutes already worked out. Don't invent places, events, prices or opening hours. If nothing on the list fits a request, say so and suggest the closest match or a general idea (e.g. "stretch outside for 10 minutes").

Keep replies short: a student should be able to read one in under 15 seconds. Lead with a clear recommendation, give the time math (walk, time there, minutes to spare), and offer one alternative at most. You can also help with coordinating with friends, e.g. drafting a quick invite message.`;

export function chatSystemPrompt(ctx: RankContext, candidates: Candidate[]) {
  return [
    { type: "text" as const, text: CHAT_SYSTEM },
    {
      type: "text" as const,
      text: `Student context:\n${JSON.stringify(studentContext(ctx))}\n\nNearby options that fit the break:\n${JSON.stringify(candidates.map(compactCandidate))}`,
    },
  ];
}

export function streamChat(system: ReturnType<typeof chatSystemPrompt>, messages: Anthropic.Beta.BetaMessageParam[]) {
  return getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 8000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages,
    },
    { timeout: 60_000 },
  );
}
