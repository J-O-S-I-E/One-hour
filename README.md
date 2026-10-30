# One-Hour Break Planner

A web app that helps college students in cities pick something worthwhile to do with a short break between classes, in under a minute.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind v4) · Supabase (Auth, Postgres + RLS, Realtime) · Claude (`claude-opus-5-5`) via the Anthropic SDK.

## Features (mapped to the spec)

| Spec item | Where |
|---|---|
| Open → suggestions → decide in < 1 min | `/plan`: pick break length + optional mood → 3 ranked picks → "Let's go". Decision time is measured from opening the planner. |
| Personalized AI recommendations | `src/lib/candidates.ts` filters places/events that fit the break (walk there + time on site + walk back + 5 min buffer, opening hours, walking radius, budget). `src/lib/claude.ts` has Claude rank the top 3 with a pitch, reason and time plan. Falls back to heuristic ranking if Claude is unavailable or slow. |
| Real-time event feed / pop-ups | `/events`: live via Supabase Realtime. Students post pop-ups (free food, pickup games). External events are pulled by `/api/events/ingest` (Ticketmaster adapter included; add more in `src/lib/event-sources.ts`). |
| Social coordination | `/friends`: add by username. "Let friends vote" turns your 3 picks into a group poll (`/plans/[id]`) with live votes and RSVPs. |
| Chat | `/chat`: Break Buddy, a streaming Claude chat grounded in the same nearby, time-fitted options. |
| Feedback loop | Post-activity rating (1–5, "first time?", comment). Recent feedback is sent to Claude, and repeatedly low-rated categories are down-weighted. |
| Evaluation plan & thresholds | `/metrics`: each success criterion vs target/anti-signal, plus the pre-committed Kill / Iterate / Scale verdict, and Graduate after 3 consecutive months at Scale. Backed by `get_success_metrics()` in SQL (aggregates only). |
| Analytics instrumentation | `analytics_events` table + `track()` for funnel events (planner opened, suggestions shown, decided, directions opened, invites, votes…). |

## Setup

1. **Supabase project.** Create one at supabase.com, then run `supabase/migrations/0001_schema.sql` and `supabase/seed.sql` in the SQL editor (or use `supabase db push`). The seed creates a demo campus with placeholder places. Replace it with real campus data before a pilot.
2. **Auth.** In Supabase → Authentication → URL configuration, add `http://localhost:3000/auth/callback` (and your production URL) to the redirect URLs.
3. **Env.** `cp .env.example .env.local` and fill in the Supabase URL/publishable key and `ANTHROPIC_API_KEY`. `SUPABASE_SERVICE_ROLE_KEY`, `TICKETMASTER_API_KEY` and `CRON_SECRET` are only needed for external event ingestion.
4. **Run.**
   ```bash
   npm install
   npm run dev
   ```
   Sign up, finish onboarding (pick the demo campus), and hit **Find my break**.

### Event ingestion

`GET /api/events/ingest` with `Authorization: Bearer $CRON_SECRET` pulls the next 6 hours of events near each campus and upserts them. `vercel.json` schedules it every 15 minutes on Vercel. Elsewhere, call it from any scheduler.

## Project layout

```
supabase/                 schema (tables, RLS, metrics function, realtime) + demo seed
src/proxy.ts              session refresh + auth gate (Next 16 "proxy", formerly middleware)
src/lib/candidates.ts     time-fit filtering and heuristic scoring
src/lib/claude.ts         Claude ranking (structured output) + chat streaming
src/lib/planning.ts       loads profile, places, events, history → candidates
src/lib/metrics.ts        success criteria + kill/scale thresholds
src/app/api/*             suggest, decide, feedback, chat, plans, events/ingest
src/app/(app)/*           plan, events, chat, friends, plans/[id], me, metrics, onboarding
```

## Notes and open items from the spec

- **Real-time data sources:** the spec lists these as unconfirmed. Ticketmaster mostly lists ticketed shows, so campus-specific sources (student org calendars, campus events APIs) are the most valuable next adapter.
- **Claude settings:** ranking uses `effort: "low"` because latency is on the critical path of the < 1 min decision. Both calls use server-side refusal fallbacks (`fallbacks: "default"`).
- **Metric definitions:** activity completion = decided breaks the student confirmed doing (rated). Satisfaction = 4–5★ ratings. The verdict waits for at least 30 sessions with ratings.
