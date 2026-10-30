import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCandidates } from "./candidates";
import type { FeedbackNote, RankContext } from "./claude";
import type { Campus, CampusEvent, Candidate, Category, Mood, Place, Profile } from "./types";

export type PlanningContext = {
  profile: Profile;
  campus: Campus;
  candidates: Candidate[];
  rankContext: RankContext;
};

type Options = {
  breakMinutes: number;
  mood: Mood | null;
  origin?: { lat: number; lng: number } | null;
  now?: Date;
};

export class PlanningError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function loadPlanningContext(
  supabase: SupabaseClient,
  userId: string,
  opts: Options,
): Promise<PlanningContext> {
  const now = opts.now ?? new Date();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single<Profile>();
  if (!profile?.campus_id) throw new PlanningError("Finish onboarding to pick your campus first.", 409);

  const horizon = new Date(now.getTime() + opts.breakMinutes * 60_000).toISOString();
  const [campusRes, placesRes, eventsRes, historyRes] = await Promise.all([
    supabase.from("campuses").select("*").eq("id", profile.campus_id).single<Campus>(),
    supabase.from("places").select("*").eq("campus_id", profile.campus_id),
    supabase
      .from("events")
      .select("*")
      .eq("campus_id", profile.campus_id)
      .gt("ends_at", now.toISOString())
      .lt("starts_at", horizon),
    supabase
      .from("break_sessions")
      .select("chosen, feedback(rating, comment)")
      .eq("user_id", userId)
      .not("chosen", "is", null)
      .order("suggested_at", { ascending: false })
      .limit(50),
  ]);
  const campus = campusRes.data;
  if (!campus) throw new PlanningError("Campus not found.", 404);

  type HistoryRow = {
    chosen: { id: string; name: string; category: Category } | null;
    feedback: { rating: number; comment: string } | { rating: number; comment: string }[] | null;
  };
  const history = (historyRes.data ?? []) as HistoryRow[];
  const triedIds = new Set(history.map((h) => h.chosen?.id).filter((id): id is string => Boolean(id)));

  const recentFeedback: FeedbackNote[] = [];
  const categoryRatings = new Map<Category, number[]>();
  for (const h of history) {
    const fb = Array.isArray(h.feedback) ? h.feedback[0] : h.feedback;
    if (!fb || !h.chosen) continue;
    if (recentFeedback.length < 10) {
      recentFeedback.push({ name: h.chosen.name, category: h.chosen.category, rating: fb.rating, comment: fb.comment });
    }
    categoryRatings.set(h.chosen.category, [...(categoryRatings.get(h.chosen.category) ?? []), fb.rating]);
  }
  const dislikedCategories = new Set(
    [...categoryRatings].filter(([, r]) => r.length >= 2 && r.reduce((a, b) => a + b, 0) / r.length < 2.5).map(([c]) => c),
  );

  const candidates = buildCandidates({
    profile,
    campus,
    places: (placesRes.data ?? []) as Place[],
    events: (eventsRes.data ?? []) as CampusEvent[],
    breakMinutes: opts.breakMinutes,
    mood: opts.mood,
    origin: opts.origin ?? { lat: campus.lat, lng: campus.lng },
    now,
    triedIds,
    dislikedCategories,
  });

  const localTime = new Intl.DateTimeFormat("en-US", {
    timeZone: campus.timezone,
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return {
    profile,
    campus,
    candidates,
    rankContext: { profile, breakMinutes: opts.breakMinutes, mood: opts.mood, localTime, recentFeedback },
  };
}
