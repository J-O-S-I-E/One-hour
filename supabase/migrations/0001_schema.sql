-- One-Hour Break Planner: core schema
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Campuses & places
-- ---------------------------------------------------------------------------
create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now()
);

create type public.activity_category as enum (
  'eat', 'exercise', 'socialize', 'explore', 'relax', 'study', 'event'
);

-- Standing places students can go to any day (cafes, gyms, parks...)
create table public.places (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  name text not null,
  category public.activity_category not null,
  description text not null default '',
  lat double precision not null,
  lng double precision not null,
  typical_duration_min int not null default 30 check (typical_duration_min between 5 and 240),
  price_level int not null default 1 check (price_level between 0 and 3), -- 0 = free
  tags text[] not null default '{}',
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now()
);
create index places_campus_idx on public.places(campus_id);

-- ---------------------------------------------------------------------------
-- Profiles & preferences
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  campus_id uuid references public.campuses(id),
  interests public.activity_category[] not null default '{}',
  budget int not null default 1 check (budget between 0 and 3),
  dietary text[] not null default '{}',
  max_walk_minutes int not null default 10 check (max_walk_minutes between 1 and 30),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Real-time events (campus feed, pop-ups, external APIs)
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  category public.activity_category not null default 'event',
  location_name text not null default '',
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_popup boolean not null default false,
  price_level int not null default 0 check (price_level between 0 and 3),
  url text,
  source text not null default 'user' check (source in ('user', 'campus', 'ticketmaster')),
  external_id text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (source, external_id)
);
create index events_campus_time_idx on public.events(campus_id, ends_at);

-- ---------------------------------------------------------------------------
-- Break sessions: one per "plan my break" request. Drives the core metrics.
-- ---------------------------------------------------------------------------
create table public.break_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campus_id uuid references public.campuses(id),
  break_minutes int not null check (break_minutes between 10 and 180),
  mood text,
  opened_at timestamptz not null,          -- when the user opened the planner
  suggested_at timestamptz not null default now(),
  suggestions jsonb not null default '[]',
  ranker text not null default 'claude' check (ranker in ('claude', 'heuristic')),
  chosen jsonb,
  decided_at timestamptz,
  decision_ms int,                          -- opened_at -> decided_at
  status text not null default 'suggested'
    check (status in ('suggested', 'decided', 'completed', 'skipped')),
  completed_at timestamptz
);
create index break_sessions_user_idx on public.break_sessions(user_id, suggested_at desc);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references public.break_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  was_new boolean not null default false,  -- "first time trying this?" -> discovery metric
  comment text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Social: friends, group plans, polls
-- ---------------------------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee),
  unique (requester, addressee)
);

create table public.group_plans (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.break_sessions(id) on delete set null,
  title text not null,
  meet_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.plan_members (
  plan_id uuid not null references public.group_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'going', 'declined')),
  invited_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.group_plans(id) on delete cascade,
  title text not null,
  detail jsonb not null default '{}',
  position int not null default 0
);

create table public.poll_votes (
  plan_id uuid not null references public.group_plans(id) on delete cascade,
  option_id uuid not null references public.poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)            -- one vote per member per plan
);

-- ---------------------------------------------------------------------------
-- Product analytics (instrumentation for the evaluation plan)
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index analytics_events_name_idx on public.analytics_events(name, created_at);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.campuses enable row level security;
alter table public.places enable row level security;
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.break_sessions enable row level security;
alter table public.feedback enable row level security;
alter table public.friendships enable row level security;
alter table public.group_plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.analytics_events enable row level security;

create policy "campuses readable" on public.campuses for select to authenticated using (true);
create policy "places readable" on public.places for select to authenticated using (true);

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "events readable" on public.events for select to authenticated using (true);
create policy "post events" on public.events for insert to authenticated
  with check (created_by = auth.uid() and source = 'user');
create policy "delete own events" on public.events for delete to authenticated
  using (created_by = auth.uid());

create policy "own sessions" on public.break_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own feedback" on public.feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "see own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "send friend request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
create policy "accept friend request" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid());
create policy "remove friendship" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- Plan membership helper (security definer avoids recursive RLS on plan_members)
create or replace function public.is_plan_member(p_plan uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_plans where id = p_plan and owner = auth.uid())
      or exists (select 1 from plan_members where plan_id = p_plan and user_id = auth.uid());
$$;

create or replace function public.is_friend(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = auth.uid() and addressee = other) or (addressee = auth.uid() and requester = other))
  );
$$;

create policy "members see plan" on public.group_plans for select to authenticated
  using (public.is_plan_member(id));
create policy "create plan" on public.group_plans for insert to authenticated
  with check (owner = auth.uid());
create policy "owner edits plan" on public.group_plans for update to authenticated
  using (owner = auth.uid());
create policy "owner deletes plan" on public.group_plans for delete to authenticated
  using (owner = auth.uid());

create policy "members see members" on public.plan_members for select to authenticated
  using (public.is_plan_member(plan_id));
create policy "owner invites friends" on public.plan_members for insert to authenticated
  with check (
    exists (select 1 from public.group_plans where id = plan_id and owner = auth.uid())
    and (user_id = auth.uid() or public.is_friend(user_id))
  );
create policy "member rsvps" on public.plan_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members see options" on public.poll_options for select to authenticated
  using (public.is_plan_member(plan_id));
create policy "owner adds options" on public.poll_options for insert to authenticated
  with check (exists (select 1 from public.group_plans where id = plan_id and owner = auth.uid()));

create policy "members see votes" on public.poll_votes for select to authenticated
  using (public.is_plan_member(plan_id));
create policy "members vote" on public.poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_plan_member(plan_id));
create policy "members change vote" on public.poll_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members remove vote" on public.poll_votes for delete to authenticated
  using (user_id = auth.uid());

create policy "log own analytics" on public.analytics_events for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Success-criteria metrics (aggregates only; security definer so the
-- dashboard can read totals without exposing other users' rows)
-- ---------------------------------------------------------------------------
create or replace function public.get_success_metrics(
  p_since timestamptz default now() - interval '30 days',
  p_until timestamptz default now()
)
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (
    select * from break_sessions where suggested_at >= p_since and suggested_at < p_until
  ),
  active_users as (
    select distinct user_id from s
  ),
  inviters as (
    select distinct gp.owner as user_id
    from group_plans gp
    join plan_members pm on pm.plan_id = gp.id and pm.user_id <> gp.owner
    where gp.created_at >= p_since and gp.created_at < p_until
  ),
  f as (
    select fb.* from feedback fb join s on s.id = fb.session_id
  )
  select jsonb_build_object(
    'sessions', (select count(*) from s),
    'active_users', (select count(*) from active_users),
    'decided', (select count(*) from s where decided_at is not null),
    'decided_under_60s', (select count(*) from s where decision_ms is not null and decision_ms < 60000),
    'decided_over_120s', (select count(*) from s where decision_ms is not null and decision_ms > 120000),
    'median_decision_ms', (select percentile_cont(0.5) within group (order by decision_ms) from s where decision_ms is not null),
    'completed', (select count(*) from s where status = 'completed'),
    'feedback_count', (select count(*) from f),
    'positive_feedback', (select count(*) from f where rating >= 4),
    'avg_rating', (select avg(rating) from f),
    'new_discoveries', (select count(distinct user_id) from f where was_new),
    'users_sent_invites', (select count(*) from inviters i join active_users a using (user_id)),
    'claude_ranked', (select count(*) from s where ranker = 'claude')
  );
$$;

revoke execute on function public.get_success_metrics(timestamptz, timestamptz) from public, anon;
grant execute on function public.get_success_metrics(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.poll_votes;
alter publication supabase_realtime add table public.plan_members;
