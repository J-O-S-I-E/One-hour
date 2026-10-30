"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, CATEGORY_EMOJI, CATEGORY_LABEL, type Campus, type Category, type Profile } from "@/lib/types";

const BUDGETS = ["Free only", "$", "$$", "$$$"];
const DIETARY = ["vegetarian", "vegan", "halal", "gluten-free"];

export function PreferencesForm({ profile, campuses }: { profile: Profile; campuses: Campus[] }) {
  const router = useRouter();
  const [username, setUsername] = useState(profile.username ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [campusId, setCampusId] = useState(profile.campus_id ?? campuses[0]?.id ?? "");
  const [interests, setInterests] = useState<Category[]>(profile.interests);
  const [budget, setBudget] = useState(profile.budget);
  const [dietary, setDietary] = useState<string[]>(profile.dietary);
  const [maxWalk, setMaxWalk] = useState(profile.max_walk_minutes);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await createClient()
      .from("profiles")
      .update({
        username: username.toLowerCase(),
        display_name: displayName,
        campus_id: campusId,
        interests,
        budget,
        dietary,
        max_walk_minutes: maxWalk,
        onboarded: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "That username is taken." : error.message);
      return;
    }
    track(profile.onboarded ? "preferences_updated" : "onboarding_completed", { interests, budget });
    router.push("/plan");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="display">
            Display name
          </label>
          <input id="display" className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="username">
            Username (friends find you by this)
          </label>
          <input
            id="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            pattern="[a-zA-Z0-9_]{3,24}"
            title="3–24 letters, numbers or underscores"
            required
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="campus">
          Campus
        </label>
        <select id="campus" className="input" value={campusId} onChange={(e) => setCampusId(e.target.value)} required>
          {campuses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.city}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="label">What do you like doing on a break?</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c !== "event").map((c) => (
            <button
              type="button"
              key={c}
              className="chip"
              data-on={interests.includes(c)}
              aria-pressed={interests.includes(c)}
              onClick={() => setInterests(toggle(interests, c))}
            >
              <span aria-hidden>{CATEGORY_EMOJI[c]}</span> {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Typical budget</legend>
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b, i) => (
            <button type="button" key={b} className="chip" data-on={budget === i} aria-pressed={budget === i} onClick={() => setBudget(i)}>
              {b}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Dietary needs</legend>
        <div className="flex flex-wrap gap-2">
          {DIETARY.map((d) => (
            <button
              type="button"
              key={d}
              className="chip"
              data-on={dietary.includes(d)}
              aria-pressed={dietary.includes(d)}
              onClick={() => setDietary(toggle(dietary, d))}
            >
              {d}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="walk">
          Max walk each way: <span className="font-semibold text-text">{maxWalk} min</span>
        </label>
        <input
          id="walk"
          type="range"
          min={2}
          max={20}
          value={maxWalk}
          onChange={(e) => setMaxWalk(Number(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy || interests.length === 0}>
        {busy ? "Saving…" : profile.onboarded ? "Save" : "Start planning"}
      </button>
      {interests.length === 0 && <p className="text-sm text-muted">Pick at least one interest.</p>}
    </form>
  );
}
