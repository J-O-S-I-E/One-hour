"use client";

import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { mapsUrl, walkMinutes } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL, type Campus, type CampusEvent, type Category } from "@/lib/types";
import { useOrigin } from "@/lib/use-origin";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function EventFeed({
  campus,
  initialEvents,
  userId,
}: {
  campus: Campus;
  initialEvents: CampusEvent[];
  userId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<"all" | "now" | "popup">("all");
  const [showForm, setShowForm] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`events:${campus.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `campus_id=eq.${campus.id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setEvents((prev) => prev.filter((e) => e.id !== (payload.old as { id: string }).id));
          } else {
            const e = payload.new as CampusEvent;
            setEvents((prev) =>
              [...prev.filter((x) => x.id !== e.id), e].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
            );
          }
        },
      )
      .subscribe();
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      void supabase.removeChannel(channel);
      clearInterval(tick);
    };
  }, [campus.id]);

  const visible = useMemo(
    () =>
      events.filter((e) => {
        if (new Date(e.ends_at).getTime() <= now) return false;
        if (filter === "now") return new Date(e.starts_at).getTime() <= now + 15 * 60_000;
        if (filter === "popup") return e.is_popup;
        return true;
      }),
    [events, filter, now],
  );

  async function remove(id: string) {
    await createClient().from("events").delete().eq("id", id);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Happening nearby
            <span className="relative flex size-2.5" title="Live">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-good opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-good" />
            </span>
          </h1>
          <p className="text-sm text-muted">{campus.name} · updates live</p>
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "+ Post a pop-up"}
        </button>
      </div>

      {showForm && <PopupForm campus={campus} userId={userId} onPosted={() => setShowForm(false)} />}

      <div className="flex gap-2">
        {(
          [
            ["all", "All"],
            ["now", "Happening now"],
            ["popup", "Pop-ups"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} className="chip" data-on={filter === k} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card text-center text-sm text-muted">
          Nothing posted yet. Spotted free food or a pickup game? Post it for everyone.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((e) => {
            const live = new Date(e.starts_at).getTime() <= now;
            const endsIn = Math.round((new Date(e.ends_at).getTime() - now) / 60_000);
            return (
              <li key={e.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted">
                      <span aria-hidden>{CATEGORY_EMOJI[e.category]}</span> {CATEGORY_LABEL[e.category]}
                      {e.location_name && ` · ${e.location_name}`}
                    </p>
                    <h2 className="font-semibold">{e.title}</h2>
                  </div>
                  {e.is_popup && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-strong">
                      Pop-up
                    </span>
                  )}
                </div>
                {e.description && <p className="text-sm">{e.description}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {live ? (
                    <span className={endsIn < 30 ? "font-semibold text-warn" : "font-semibold text-good"}>
                      Live · ends in {endsIn} min
                    </span>
                  ) : (
                    <span>
                      {fmtTime(e.starts_at)}–{fmtTime(e.ends_at)}
                    </span>
                  )}
                  <span>🚶 {walkMinutes(campus.lat, campus.lng, e.lat, e.lng)} min from campus</span>
                  <a
                    className="font-semibold text-accent"
                    href={mapsUrl(e.lat, e.lng)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Directions
                  </a>
                  {e.url && (
                    <a className="font-semibold text-accent" href={e.url} target="_blank" rel="noreferrer">
                      Details
                    </a>
                  )}
                  {e.created_by === userId && (
                    <button className="font-semibold text-bad" onClick={() => remove(e.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PopupForm({ campus, userId, onPosted }: { campus: Campus; userId: string; onPosted: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [category, setCategory] = useState<Category>("eat");
  const [duration, setDuration] = useState(60);
  const [free, setFree] = useState(true);
  const { origin, status, locate } = useOrigin();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const start = new Date();
    const { error } = await createClient()
      .from("events")
      .insert({
        campus_id: campus.id,
        title,
        description,
        category,
        location_name: locationName,
        lat: origin?.lat ?? campus.lat,
        lng: origin?.lng ?? campus.lng,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + duration * 60_000).toISOString(),
        is_popup: true,
        price_level: free ? 0 : 1,
        source: "user",
        created_by: userId,
      });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    track("popup_posted", { category, duration });
    onPosted();
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <input className="input" placeholder="What's happening? e.g. Free bagels" value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={120} required />
      <input className="input" placeholder="Where exactly? e.g. Library steps" value={locationName} onChange={(e) => setLocationName(e.target.value)} required />
      <textarea className="input" placeholder="Details (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.filter((c) => c !== "study").map((c) => (
          <button type="button" key={c} className="chip" data-on={category === c} onClick={() => setCategory(c)}>
            <span aria-hidden>{CATEGORY_EMOJI[c]}</span> {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          Lasts about
          <select className="input w-auto py-1.5" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={free} onChange={(e) => setFree(e.target.checked)} />
          Free
        </label>
        <button type="button" className="chip" data-on={status === "precise"} onClick={locate}>
          📍 {status === "precise" ? "Pinned to my location" : status === "locating" ? "Locating…" : "Use my location"}
        </button>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Posting…" : "Post it"}
      </button>
    </form>
  );
}
