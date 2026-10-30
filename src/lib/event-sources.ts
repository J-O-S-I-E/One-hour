import "server-only";
import type { Campus, Category } from "./types";

/** Normalized event ready to upsert into public.events. */
export type IngestedEvent = {
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
  source: "ticketmaster";
  external_id: string;
};

/** Each source fetches events near a campus for the next few hours. Add new feeds here. */
export type EventSource = {
  name: string;
  enabled: () => boolean;
  fetch: (campus: Campus, from: Date, to: Date) => Promise<IngestedEvent[]>;
};

const tmDate = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "Z");

const TM_SEGMENT_CATEGORY: Record<string, Category> = {
  Sports: "exercise",
  Music: "socialize",
  "Arts & Theatre": "explore",
  Film: "relax",
};

type TmEvent = {
  id: string;
  name: string;
  url?: string;
  info?: string;
  dates?: { start?: { dateTime?: string }; end?: { dateTime?: string } };
  classifications?: { segment?: { name?: string } }[];
  priceRanges?: { min?: number }[];
  _embedded?: { venues?: { name?: string; location?: { latitude?: string; longitude?: string } }[] };
};

export const ticketmaster: EventSource = {
  name: "ticketmaster",
  enabled: () => Boolean(process.env.TICKETMASTER_API_KEY),
  async fetch(campus, from, to) {
    const params = new URLSearchParams({
      apikey: process.env.TICKETMASTER_API_KEY!,
      latlong: `${campus.lat},${campus.lng}`,
      radius: "1",
      unit: "miles",
      startDateTime: tmDate(from),
      endDateTime: tmDate(to),
      size: "50",
      sort: "date,asc",
    });
    const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${params}`);
    if (!res.ok) throw new Error(`Ticketmaster ${res.status}`);
    const json = (await res.json()) as { _embedded?: { events?: TmEvent[] } };

    return (json._embedded?.events ?? []).flatMap((e): IngestedEvent[] => {
      const venue = e._embedded?.venues?.[0];
      const start = e.dates?.start?.dateTime;
      const lat = Number(venue?.location?.latitude);
      const lng = Number(venue?.location?.longitude);
      if (!start || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      const end = e.dates?.end?.dateTime ?? new Date(new Date(start).getTime() + 2 * 3600_000).toISOString();
      const minPrice = e.priceRanges?.[0]?.min ?? 0;
      return [
        {
          campus_id: campus.id,
          title: e.name.slice(0, 120),
          description: e.info?.slice(0, 500) ?? "",
          category: TM_SEGMENT_CATEGORY[e.classifications?.[0]?.segment?.name ?? ""] ?? "event",
          location_name: venue?.name ?? "",
          lat,
          lng,
          starts_at: start,
          ends_at: end,
          is_popup: false,
          price_level: minPrice === 0 ? 0 : minPrice < 20 ? 1 : minPrice < 60 ? 2 : 3,
          url: e.url ?? null,
          source: "ticketmaster",
          external_id: e.id,
        },
      ];
    });
  },
};

export const EVENT_SOURCES: EventSource[] = [ticketmaster];
