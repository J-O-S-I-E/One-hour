import { localMinutes, timeToMinutes, walkMinutes } from "./geo";
import type { Campus, CampusEvent, Candidate, Category, Mood, Place, Profile } from "./types";

/** Minutes kept free at the end of the break to get back into class. */
export const RETURN_BUFFER_MIN = 5;
const MIN_ACTIVITY_MIN = 10;
const MAX_EVENT_STAY_MIN = 45;

const MOOD_CATEGORIES: Record<Mood, Category[]> = {
  hungry: ["eat"],
  energized: ["exercise", "explore", "event"],
  tired: ["relax", "eat"],
  social: ["socialize", "event", "eat"],
  curious: ["explore", "event"],
  stressed: ["relax", "exercise"],
};

const DIET_TAGS: Record<string, string[]> = {
  vegetarian: ["vegetarian", "vegan", "vegetarian-options"],
  vegan: ["vegan"],
  halal: ["halal"],
  "gluten-free": ["gluten-free"],
};

export type CandidateInput = {
  profile: Profile;
  campus: Campus;
  places: Place[];
  events: CampusEvent[];
  breakMinutes: number;
  mood: Mood | null;
  origin: { lat: number; lng: number };
  now: Date;
  /** Candidate ids the user has chosen before (for discovery). */
  triedIds: Set<string>;
  /** Categories the user rated poorly recently (feedback loop). */
  dislikedCategories: Set<Category>;
};

function isOpenFor(place: Place, nowMin: number, arriveIn: number, stay: number) {
  if (!place.opens_at || !place.closes_at) return true;
  const open = timeToMinutes(place.opens_at);
  let close = timeToMinutes(place.closes_at);
  if (close <= open) close += 24 * 60; // closes after midnight
  const start = (nowMin + arriveIn) % (24 * 60);
  // Check today's window and, for overnight hours, the tail that spills past midnight.
  return [start, start + 24 * 60].some((s) => s >= open && s + stay <= close);
}

function dietMismatch(profile: Profile, category: Category, tags: string[]) {
  if (category !== "eat") return false;
  return profile.dietary.some((d) => {
    const ok = DIET_TAGS[d];
    return ok ? !ok.some((t) => tags.includes(t)) : false;
  });
}

function score(c: Omit<Candidate, "heuristic_score">, input: CandidateInput, usable: number) {
  const { profile, mood } = input;
  let s = 0;
  if (profile.interests.includes(c.category)) s += 3;
  if (mood && MOOD_CATEGORIES[mood].includes(c.category)) s += 2.5;
  if (c.is_popup) s += 2;
  if (c.kind === "event") s += 1;
  if (!c.tried_before) s += 1;
  if (c.price_level > profile.budget) s -= 2;
  if (dietMismatch(profile, c.category, c.tags)) s -= 3;
  if (input.dislikedCategories.has(c.category)) s -= 1.5;
  s -= 0.2 * c.walk_minutes;
  s += 2 * (c.activity_minutes / usable); // reward using the break well
  return Math.round(s * 100) / 100;
}

export function buildCandidates(input: CandidateInput, limit = 15): Candidate[] {
  const { profile, campus, places, events, breakMinutes, origin, now, triedIds } = input;
  const usable = breakMinutes - RETURN_BUFFER_MIN;
  const nowMin = localMinutes(now, campus.timezone);
  const out: Candidate[] = [];

  for (const p of places) {
    const walk = walkMinutes(origin.lat, origin.lng, p.lat, p.lng);
    if (walk > profile.max_walk_minutes) continue;
    const activity = Math.min(p.typical_duration_min, usable - 2 * walk);
    if (activity < Math.max(MIN_ACTIVITY_MIN, Math.ceil(p.typical_duration_min * 0.5))) continue;
    if (!isOpenFor(p, nowMin, walk, activity)) continue;
    if (p.price_level > profile.budget + 1) continue;
    const id = `place:${p.id}`;
    const base = {
      id,
      kind: "place" as const,
      name: p.name,
      category: p.category,
      description: p.description,
      location: p.name,
      lat: p.lat,
      lng: p.lng,
      walk_minutes: walk,
      activity_minutes: activity,
      total_minutes: activity + 2 * walk,
      price_level: p.price_level,
      tags: p.tags,
      is_popup: false,
      ends_in_minutes: null,
      tried_before: triedIds.has(id),
    };
    out.push({ ...base, heuristic_score: score(base, input, usable) });
  }

  const nowMs = now.getTime();
  for (const e of events) {
    const walk = walkMinutes(origin.lat, origin.lng, e.lat, e.lng);
    if (walk > profile.max_walk_minutes) continue;
    const arriveMs = nowMs + walk * 60_000;
    const mustLeaveMs = nowMs + (usable - walk) * 60_000;
    const startMs = Math.max(arriveMs, new Date(e.starts_at).getTime());
    const endMs = Math.min(mustLeaveMs, new Date(e.ends_at).getTime());
    const activity = Math.min(MAX_EVENT_STAY_MIN, Math.floor((endMs - startMs) / 60_000));
    if (activity < MIN_ACTIVITY_MIN) continue;
    if (e.price_level > profile.budget + 1) continue;
    const id = `event:${e.id}`;
    const waitMin = Math.max(0, Math.round((startMs - arriveMs) / 60_000));
    const base = {
      id,
      kind: "event" as const,
      name: e.title,
      category: e.category,
      description: e.description + (waitMin > 0 ? ` (starts ${waitMin} min after you arrive)` : ""),
      location: e.location_name,
      lat: e.lat,
      lng: e.lng,
      walk_minutes: walk,
      activity_minutes: activity,
      total_minutes: activity + 2 * walk + waitMin,
      price_level: e.price_level,
      tags: e.is_popup ? ["pop-up"] : [],
      is_popup: e.is_popup,
      ends_in_minutes: Math.round((new Date(e.ends_at).getTime() - nowMs) / 60_000),
      tried_before: triedIds.has(id),
    };
    out.push({ ...base, heuristic_score: score(base, input, usable) });
  }

  return out.sort((a, b) => b.heuristic_score - a.heuristic_score).slice(0, limit);
}
