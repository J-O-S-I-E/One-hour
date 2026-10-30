export const CATEGORIES = ["eat", "exercise", "socialize", "explore", "relax", "study", "event"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  eat: "Eat",
  exercise: "Move",
  socialize: "Socialize",
  explore: "Explore",
  relax: "Relax",
  study: "Study",
  event: "Event",
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  eat: "🍜",
  exercise: "🏃",
  socialize: "🗣️",
  explore: "🧭",
  relax: "🌿",
  study: "📚",
  event: "🎉",
};

export const MOODS = ["hungry", "energized", "tired", "social", "curious", "stressed"] as const;
export type Mood = (typeof MOODS)[number];

export type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  campus_id: string | null;
  interests: Category[];
  budget: number;
  dietary: string[];
  max_walk_minutes: number;
  onboarded: boolean;
};

export type Campus = { id: string; name: string; city: string; lat: number; lng: number; timezone: string };

export type Place = {
  id: string;
  campus_id: string;
  name: string;
  category: Category;
  description: string;
  lat: number;
  lng: number;
  typical_duration_min: number;
  price_level: number;
  tags: string[];
  opens_at: string | null;
  closes_at: string | null;
};

export type CampusEvent = {
  id: string;
  campus_id: string;
  title: string;
  description: string;
  category: Category;
  location_name: string;
  lat: number;
  lng: number;
  starts_at: string;
  ends_at: string;
  is_popup: boolean;
  price_level: number;
  url: string | null;
  source: "user" | "campus" | "ticketmaster";
  created_by: string | null;
  created_at: string;
};

/** A place or event that fits inside the break, with its time budget worked out. */
export type Candidate = {
  id: string; // "place:<uuid>" | "event:<uuid>"
  kind: "place" | "event";
  name: string;
  category: Category;
  description: string;
  location: string;
  lat: number;
  lng: number;
  walk_minutes: number; // one way
  activity_minutes: number; // time spent there
  total_minutes: number; // walk there + activity + walk back
  price_level: number;
  tags: string[];
  is_popup: boolean;
  ends_in_minutes: number | null; // events only
  tried_before: boolean;
  heuristic_score: number;
};

export type Suggestion = Candidate & {
  rank: number;
  headline: string; // short pitch, e.g. "Free tacos 4 min away"
  reason: string; // why it fits this user right now
  plan: string; // timeline: leave by, spend, head back by
};
