-- Potluck — v2 "platform" migration.
--
-- Turns the single shared potluck into a multi-tenant platform:
--   * HOSTS sign up / sign in and can create, edit, share, and delete many
--     potlucks, with full admin control over every dish in their events.
--   * GUESTS never log in. The share link `/p/<slug>` is the capability: the
--     slug is a 12-char random code (~59 bits), and per-device ownership of
--     dishes keeps working exactly like v1 (localStorage owner UUID).
--
-- Auth model (deliberate, documented):
--   The entire backend is SECURITY DEFINER Postgres functions — no server
--   code, no GoTrue. Accounts live in `potluck_private.users` with bcrypt
--   password hashes (pgcrypto); sessions are 256-bit random tokens stored
--   only as sha256 digests in `potluck_private.sessions` (30-day expiry).
--   This keeps the API e2e-testable against the local Postgres rig and —
--   when colocated inside a shared Supabase project — completely out of the
--   host project's `auth.users` (whose triggers must not fire for potluck
--   signups). Known limitations, accepted for this app's stakes: no email
--   verification or password-reset email (no mail service), and no per-IP
--   rate limiting (bcrypt cost + generic errors are the brake).
--
-- Namespacing (this file is THE contract from v2 on):
--   * Tables live in the private `potluck` / `potluck_private` schemas,
--     which API roles cannot reach (no USAGE grant).
--   * RPC functions live in `public` (PostgREST only exposes `public`) and
--     are prefixed `potluck_`. The prefix is harmless in a dedicated project
--     and prevents collisions in a shared one, so one migration serves both.
--   * Every GRANT/REVOKE names a specific potluck function. NEVER a blanket
--     `revoke ... on all ... in schema public` — in a shared project that
--     would strip the host app's own privileges.
--
-- Frontend: set VITE_RPC_PREFIX=potluck_ (see .env.example).
-- Idempotent enough to re-run: drops all v1 and v2 potluck objects first.

-- ---------------------------------------------------------------------------
-- Drop v1 (both the original unprefixed contract and the colocated prefixed
-- variant) and any previous v2 objects.
-- ---------------------------------------------------------------------------

-- v1 unprefixed (supabase/migrations/0001_potluck.sql)
drop function if exists public.list_dishes(uuid);
drop function if exists public.create_dish(uuid, text, text, integer, text);
drop function if exists public.update_dish(uuid, uuid, text, text, text, integer, text, boolean);
drop function if exists public.claim_dish(uuid, uuid, text);
drop function if exists public.delete_dish(uuid, uuid, text);
drop function if exists public.get_settings();
drop function if exists public.set_guest_count(integer);
drop function if exists public.verify_host(text);
drop table if exists public.dishes cascade;
drop table if exists public.settings cascade;
drop schema if exists private cascade;

-- v1 colocated + any previous v2
drop function if exists public.potluck_list_dishes(uuid);
drop function if exists public.potluck_create_dish(uuid, text, text, integer, text);
drop function if exists public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean);
drop function if exists public.potluck_claim_dish(uuid, uuid, text);
drop function if exists public.potluck_delete_dish(uuid, uuid, text);
drop function if exists public.potluck_get_settings();
drop function if exists public.potluck_set_guest_count(integer);
drop function if exists public.potluck_verify_host(text);
drop function if exists public.potluck_sign_up(text, text, text);
drop function if exists public.potluck_sign_in(text, text);
drop function if exists public.potluck_sign_out(text);
drop function if exists public.potluck_me(text);
drop function if exists public.potluck_change_password(text, text, text);
drop function if exists public.potluck_create_event(text, text, date, text, text, integer);
drop function if exists public.potluck_update_event(uuid, text, text, date, boolean, text, boolean, text, boolean, integer);
drop function if exists public.potluck_delete_event(uuid, text);
drop function if exists public.potluck_rotate_slug(uuid, text);
drop function if exists public.potluck_my_events(text);
drop function if exists public.potluck_get_event(text, uuid, text);
drop function if exists public.potluck_create_dish(text, uuid, text, text, integer, text);
drop schema if exists potluck cascade;
drop schema if exists potluck_private cascade;

-- ---------------------------------------------------------------------------
-- Extensions + schemas
-- ---------------------------------------------------------------------------

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema potluck;
create schema potluck_private;

revoke all on schema potluck from public, anon, authenticated;
revoke all on schema potluck_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table potluck_private.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null
                constraint users_email_len check (char_length(email) between 3 and 254),
  password_hash text not null,
  name          text not null
                constraint users_name_len check (char_length(name) between 1 and 80),
  created_at    timestamptz not null default now()
);

create unique index users_email_unique on potluck_private.users (lower(email));

create table potluck_private.sessions (
  token_hash bytea primary key,
  user_id    uuid not null references potluck_private.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index sessions_user_id on potluck_private.sessions (user_id);

create table potluck.events (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique
               constraint events_slug_len check (char_length(slug) = 12),
  name         text not null
               constraint events_name_len check (char_length(name) between 1 and 80),
  event_date   date,
  location     text
               constraint events_location_len
               check (location is null or char_length(location) between 1 and 120),
  description  text
               constraint events_description_len
               check (description is null or char_length(description) between 1 and 500),
  guest_count  integer not null default 20
               constraint events_guest_count_range check (guest_count between 0 and 9999),
  host_user_id uuid not null references potluck_private.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index events_host_user_id on potluck.events (host_user_id);

create table potluck.dishes (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references potluck.events (id) on delete cascade,
  name       text not null
             constraint dishes_name_len check (char_length(name) between 1 and 120),
  category   text not null
             constraint dishes_category_valid
             check (category in ('appetizer', 'main', 'side', 'dessert', 'drink', 'other')),
  servings   integer not null
             constraint dishes_servings_range check (servings between 1 and 999),
  brought_by text
             constraint dishes_brought_by_len
             check (brought_by is null or char_length(brought_by) between 1 and 80),
  owner_id   uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dishes_event_id on potluck.dishes (event_id);

alter table potluck_private.users    enable row level security;
alter table potluck_private.sessions enable row level security;
alter table potluck.events           enable row level security;
alter table potluck.dishes           enable row level security;

-- ---------------------------------------------------------------------------
-- Internal helpers (private schemas — never exposed through PostgREST)
-- ---------------------------------------------------------------------------

create or replace function potluck.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on potluck.events
  for each row execute function potluck.touch_updated_at();

create trigger dishes_touch_updated_at
  before update on potluck.dishes
  for each row execute function potluck.touch_updated_at();

create or replace function potluck.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

-- 256-bit random session token, returned to the client as 64 hex chars.
create or replace function potluck.new_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(32), 'hex');
$$;

-- 12 chars from a 31-char alphabet with no lookalikes (~59 bits): the share
-- link is the guests' capability, so it must be unguessable in practice.
create or replace function potluck.new_slug()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('abcdefghjkmnpqrstuvwxyz23456789', 1 + (get_byte(b, i) % 31), 1),
    '' order by i
  )
  from extensions.gen_random_bytes(12) as b, generate_series(0, 11) as i;
$$;

-- Resolves a session token to a user id; null for missing/invalid/expired.
create or replace function potluck.auth_user_id(p_token text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select s.user_id
  from potluck_private.sessions s
  where p_token is not null
    and s.token_hash = potluck.hash_token(p_token)
    and s.expires_at > now();
$$;

create or replace function potluck.create_session(p_user_id uuid)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_token text := potluck.new_token();
begin
  insert into potluck_private.sessions (token_hash, user_id, expires_at)
  values (potluck.hash_token(v_token), p_user_id, now() + interval '30 days');
  return v_token;
end;
$$;

create or replace function potluck.user_json(u potluck_private.users)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', u.id, 'email', u.email, 'name', u.name, 'createdAt', u.created_at
  );
$$;

create or replace function potluck.event_json(e potluck.events, p_is_host boolean)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'slug', e.slug,
    'name', e.name,
    'date', e.event_date,
    'location', e.location,
    'description', e.description,
    'guestCount', e.guest_count,
    'isHost', p_is_host,
    'createdAt', e.created_at,
    'updatedAt', e.updated_at
  );
$$;

create or replace function potluck.dish_json(d potluck.dishes, p_owner uuid)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'name', d.name, 'category', d.category, 'servings', d.servings,
    'broughtBy', d.brought_by,
    'mine', (d.owner_id is not null and d.owner_id = p_owner),
    'createdAt', d.created_at, 'updatedAt', d.updated_at
  );
$$;

-- Auth + ownership gate for host admin actions. Raises in order:
-- not_signed_in (bad/expired token), event_not_found, not_event_host.
create or replace function potluck.require_event_host(p_event_id uuid, p_token text)
returns potluck.events
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := potluck.auth_user_id(p_token);
  e potluck.events;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  select * into e from potluck.events where id = p_event_id;
  if not found then
    raise exception 'event_not_found';
  end if;
  if e.host_user_id <> v_user then
    raise exception 'not_event_host';
  end if;
  return e;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC API — accounts
-- ---------------------------------------------------------------------------

create or replace function public.potluck_sign_up(p_email text, p_password text, p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name  text := btrim(coalesce(p_name, ''));
  u potluck_private.users;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
     or char_length(v_email) > 254 then
    raise exception 'invalid_email';
  end if;
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'name_required';
  end if;
  if p_password is null or char_length(p_password) < 8 or char_length(p_password) > 200 then
    raise exception 'weak_password';
  end if;

  begin
    insert into potluck_private.users (email, password_hash, name)
    values (v_email, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), v_name)
    returning * into u;
  exception when unique_violation then
    raise exception 'email_taken';
  end;

  return jsonb_build_object(
    'token', potluck.create_session(u.id),
    'user', potluck.user_json(u)
  );
end;
$$;

create or replace function public.potluck_sign_in(p_email text, p_password text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  u potluck_private.users;
begin
  -- Opportunistic cleanup of expired sessions.
  delete from potluck_private.sessions where expires_at < now();

  select * into u
  from potluck_private.users
  where lower(email) = lower(btrim(coalesce(p_email, '')));

  if not found then
    -- Burn comparable bcrypt time so missing accounts are not distinguishable
    -- from wrong passwords by response latency.
    perform extensions.crypt(coalesce(p_password, ''), extensions.gen_salt('bf', 10));
    raise exception 'invalid_credentials';
  end if;

  if u.password_hash <> extensions.crypt(coalesce(p_password, ''), u.password_hash) then
    raise exception 'invalid_credentials';
  end if;

  return jsonb_build_object(
    'token', potluck.create_session(u.id),
    'user', potluck.user_json(u)
  );
end;
$$;

create or replace function public.potluck_sign_out(p_token text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from potluck_private.sessions
  where token_hash = potluck.hash_token(coalesce(p_token, ''));
$$;

-- Session probe used on app boot; returns the user or SQL null, never raises.
create or replace function public.potluck_me(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select potluck.user_json(u)
  from potluck_private.users u
  where u.id = potluck.auth_user_id(p_token);
$$;

create or replace function public.potluck_change_password(
  p_token text, p_current text, p_new text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := potluck.auth_user_id(p_token);
  u potluck_private.users;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if p_new is null or char_length(p_new) < 8 or char_length(p_new) > 200 then
    raise exception 'weak_password';
  end if;

  select * into u from potluck_private.users where id = v_user;
  if u.password_hash <> extensions.crypt(coalesce(p_current, ''), u.password_hash) then
    raise exception 'invalid_credentials';
  end if;

  update potluck_private.users
  set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10))
  where id = v_user;

  -- Sign out every other device; the current session stays valid.
  delete from potluck_private.sessions
  where user_id = v_user
    and token_hash <> potluck.hash_token(p_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC API — events (host admin)
-- ---------------------------------------------------------------------------

create or replace function public.potluck_create_event(
  p_token       text,
  p_name        text,
  p_date        date default null,
  p_location    text default null,
  p_description text default null,
  p_guest_count integer default 20
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := potluck.auth_user_id(p_token);
  v_name text := btrim(coalesce(p_name, ''));
  e potluck.events;
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;
  if v_name = '' then
    raise exception 'name_required';
  end if;
  if p_guest_count is null or p_guest_count < 0 or p_guest_count > 9999 then
    raise exception 'guest_count_out_of_range';
  end if;
  if (select count(*) from potluck.events where host_user_id = v_user) >= 25 then
    raise exception 'event_limit_reached';
  end if;

  for i in 1..5 loop
    begin
      insert into potluck.events (slug, name, event_date, location, description, guest_count, host_user_id)
      values (
        potluck.new_slug(),
        v_name,
        p_date,
        nullif(btrim(coalesce(p_location, '')), ''),
        nullif(btrim(coalesce(p_description, '')), ''),
        p_guest_count,
        v_user
      )
      returning * into e;
      return potluck.event_json(e, true);
    exception when unique_violation then
      -- astronomically unlikely slug collision; retry with a fresh one
    end;
  end loop;
  raise exception 'slug_generation_failed';
end;
$$;

create or replace function public.potluck_update_event(
  p_event_id          uuid,
  p_token             text,
  p_name              text default null,
  p_date              date default null,
  p_clear_date        boolean default false,
  p_location          text default null,
  p_clear_location    boolean default false,
  p_description       text default null,
  p_clear_description boolean default false,
  p_guest_count       integer default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e potluck.events := potluck.require_event_host(p_event_id, p_token);
begin
  if p_guest_count is not null and (p_guest_count < 0 or p_guest_count > 9999) then
    raise exception 'guest_count_out_of_range';
  end if;

  update potluck.events
  set name        = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
      event_date  = case when p_clear_date then null else coalesce(p_date, event_date) end,
      location    = case when p_clear_location then null
                         else coalesce(nullif(btrim(coalesce(p_location, '')), ''), location) end,
      description = case when p_clear_description then null
                         else coalesce(nullif(btrim(coalesce(p_description, '')), ''), description) end,
      guest_count = coalesce(p_guest_count, guest_count)
  where id = e.id
  returning * into e;

  return potluck.event_json(e, true);
end;
$$;

create or replace function public.potluck_delete_event(p_event_id uuid, p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e potluck.events := potluck.require_event_host(p_event_id, p_token);
begin
  delete from potluck.events where id = e.id;
end;
$$;

-- Admin control: revoke the old share link by minting a new slug.
create or replace function public.potluck_rotate_slug(p_event_id uuid, p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  e potluck.events := potluck.require_event_host(p_event_id, p_token);
begin
  for i in 1..5 loop
    begin
      update potluck.events set slug = potluck.new_slug()
      where id = e.id
      returning * into e;
      return potluck.event_json(e, true);
    exception when unique_violation then
      -- retry with a fresh slug
    end;
  end loop;
  raise exception 'slug_generation_failed';
end;
$$;

create or replace function public.potluck_my_events(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := potluck.auth_user_id(p_token);
begin
  if v_user is null then
    raise exception 'not_signed_in';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        potluck.event_json(e, true) || jsonb_build_object(
          'dishCount', s.dish_count,
          'totalServings', s.total_servings,
          'unclaimedCount', s.unclaimed_count
        )
        order by e.created_at desc, e.id desc
      )
      from potluck.events e
      cross join lateral (
        select count(*) as dish_count,
               coalesce(sum(d.servings), 0) as total_servings,
               count(*) filter (where d.brought_by is null) as unclaimed_count
        from potluck.dishes d
        where d.event_id = e.id
      ) s
      where e.host_user_id = v_user
    ),
    '[]'::jsonb
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC API — the event page (guests + host, one poll per refresh)
-- ---------------------------------------------------------------------------

create or replace function public.potluck_get_event(
  p_slug text, p_owner uuid, p_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e potluck.events;
  v_is_host boolean;
begin
  select * into e from potluck.events where slug = coalesce(p_slug, '');
  if not found then
    raise exception 'event_not_found';
  end if;

  v_is_host := (potluck.auth_user_id(p_token) = e.host_user_id);

  return jsonb_build_object(
    'event', potluck.event_json(e, coalesce(v_is_host, false)),
    'dishes', coalesce(
      (
        select jsonb_agg(potluck.dish_json(d, p_owner) order by d.created_at desc, d.id desc)
        from potluck.dishes d
        where d.event_id = e.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC API — dishes (guests by share link; hosts get admin override)
-- ---------------------------------------------------------------------------

create or replace function public.potluck_create_dish(
  p_slug       text,
  p_owner      uuid,
  p_name       text,
  p_category   text,
  p_servings   integer,
  p_brought_by text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  d potluck.dishes;
begin
  if p_owner is null then
    raise exception 'owner_required';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required';
  end if;

  select id into v_event_id from potluck.events where slug = coalesce(p_slug, '');
  if not found then
    raise exception 'event_not_found';
  end if;
  if (select count(*) from potluck.dishes where event_id = v_event_id) >= 200 then
    raise exception 'dish_limit_reached';
  end if;

  insert into potluck.dishes (event_id, name, category, servings, brought_by, owner_id)
  values (
    v_event_id,
    nullif(btrim(p_name), ''),
    p_category,
    p_servings,
    nullif(btrim(coalesce(p_brought_by, '')), ''),
    p_owner
  )
  returning * into d;

  return potluck.dish_json(d, p_owner);
end;
$$;

create or replace function public.potluck_update_dish(
  p_id               uuid,
  p_owner            uuid,
  p_token            text default null,
  p_name             text default null,
  p_category         text default null,
  p_servings         integer default null,
  p_brought_by       text default null,
  p_clear_brought_by boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d potluck.dishes;
  v_user uuid;
begin
  select * into d from potluck.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  v_user := potluck.auth_user_id(p_token);
  if not (
    (d.owner_id is not null and d.owner_id = p_owner)
    or (v_user is not null and exists (
      select 1 from potluck.events e
      where e.id = d.event_id and e.host_user_id = v_user
    ))
  ) then
    raise exception 'not_allowed';
  end if;

  update potluck.dishes
  set name       = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
      category   = coalesce(p_category, category),
      servings   = coalesce(p_servings, servings),
      brought_by = case
                     when p_clear_brought_by then null
                     else coalesce(nullif(btrim(coalesce(p_brought_by, '')), ''), brought_by)
                   end
  where id = d.id
  returning * into d;

  return potluck.dish_json(d, p_owner);
end;
$$;

create or replace function public.potluck_claim_dish(
  p_id    uuid,
  p_owner uuid,
  p_name  text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d potluck.dishes;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required';
  end if;

  -- Race-safe: only one claimant can flip brought_by from null.
  update potluck.dishes
  set brought_by = btrim(p_name)
  where id = p_id and brought_by is null
  returning * into d;

  if not found then
    if exists (select 1 from potluck.dishes where id = p_id) then
      raise exception 'already_claimed';
    end if;
    raise exception 'dish_not_found';
  end if;

  return potluck.dish_json(d, p_owner);
end;
$$;

create or replace function public.potluck_delete_dish(
  p_id    uuid,
  p_owner uuid,
  p_token text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d potluck.dishes;
  v_user uuid;
begin
  select * into d from potluck.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  v_user := potluck.auth_user_id(p_token);
  if not (
    (d.owner_id is not null and d.owner_id = p_owner)
    or (v_user is not null and exists (
      select 1 from potluck.events e
      where e.id = d.event_id and e.host_user_id = v_user
    ))
  ) then
    raise exception 'not_allowed';
  end if;

  delete from potluck.dishes where id = d.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants — SCOPED to the potluck functions only. Never a blanket revoke.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.potluck_sign_up(text, text, text),
  public.potluck_sign_in(text, text),
  public.potluck_sign_out(text),
  public.potluck_me(text),
  public.potluck_change_password(text, text, text),
  public.potluck_create_event(text, text, date, text, text, integer),
  public.potluck_update_event(uuid, text, text, date, boolean, text, boolean, text, boolean, integer),
  public.potluck_delete_event(uuid, text),
  public.potluck_rotate_slug(uuid, text),
  public.potluck_my_events(text),
  public.potluck_get_event(text, uuid, text),
  public.potluck_create_dish(text, uuid, text, text, integer, text),
  public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean),
  public.potluck_claim_dish(uuid, uuid, text),
  public.potluck_delete_dish(uuid, uuid, text)
from public;

grant execute on function
  public.potluck_sign_up(text, text, text),
  public.potluck_sign_in(text, text),
  public.potluck_sign_out(text),
  public.potluck_me(text),
  public.potluck_change_password(text, text, text),
  public.potluck_create_event(text, text, date, text, text, integer),
  public.potluck_update_event(uuid, text, text, date, boolean, text, boolean, text, boolean, integer),
  public.potluck_delete_event(uuid, text),
  public.potluck_rotate_slug(uuid, text),
  public.potluck_my_events(text),
  public.potluck_get_event(text, uuid, text),
  public.potluck_create_dish(text, uuid, text, text, integer, text),
  public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean),
  public.potluck_claim_dish(uuid, uuid, text),
  public.potluck_delete_dish(uuid, uuid, text)
to anon, authenticated;
