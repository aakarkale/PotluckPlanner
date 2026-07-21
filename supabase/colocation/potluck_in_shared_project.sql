-- Potluck Tracker — COLOCATED deployment into a SHARED Supabase project.
--
-- Why this file exists: the Supabase free tier caps the account at 2 active
-- projects, so until an upgrade frees a slot the potluck backend lives inside
-- an existing project (currently "been" / MapNotes, ref mjkimkaggayvovwscrqi)
-- instead of its own. This is a namespaced variant of the canonical
-- supabase/migrations/0001_potluck.sql.
--
-- Isolation contract (so the two apps never touch each other, and extraction
-- later is trivial):
--   * All potluck TABLES live in the dedicated `potluck` / `potluck_private`
--     schemas — never in `public`.
--   * All potluck RPC FUNCTIONS live in `public` (PostgREST only exposes
--     `public`) but are prefixed `potluck_`.
--   * Every GRANT/REVOKE below names a specific potluck object. Unlike the
--     dedicated migration, this file must NEVER run a blanket
--     `revoke ... on all ... in schema public` — that would strip privileges
--     from the host project's own tables/functions and break it.
--
-- Frontend targets this deployment by setting VITE_RPC_PREFIX=potluck_ .
-- To move to a dedicated project on upgrade: create a fresh project, run the
-- clean supabase/migrations/0001_potluck.sql (public schema, unprefixed RPCs),
-- clear VITE_RPC_PREFIX, and re-point VITE_SUPABASE_URL/ANON_KEY. See
-- supabase/colocation/README.md.
--
-- Idempotent enough to re-run: it drops the potluck objects first.

drop schema if exists potluck cascade;
drop schema if exists potluck_private cascade;
drop function if exists public.potluck_list_dishes(uuid);
drop function if exists public.potluck_create_dish(uuid, text, text, integer, text);
drop function if exists public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean);
drop function if exists public.potluck_claim_dish(uuid, uuid, text);
drop function if exists public.potluck_delete_dish(uuid, uuid, text);
drop function if exists public.potluck_get_settings();
drop function if exists public.potluck_set_guest_count(integer);
drop function if exists public.potluck_verify_host(text);

-- ---------------------------------------------------------------------------
-- Schemas — isolated from the host project, unreachable by the API roles.
-- (SECURITY DEFINER functions run as the owner and reach the tables anyway.)
-- ---------------------------------------------------------------------------

create schema potluck;
create schema potluck_private;

revoke all on schema potluck from public, anon, authenticated;
revoke all on schema potluck_private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table potluck.dishes (
  id         uuid primary key default gen_random_uuid(),
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

create table potluck.settings (
  id          boolean primary key default true constraint settings_singleton check (id),
  guest_count integer not null default 20
              constraint settings_guest_count_range check (guest_count between 0 and 9999),
  updated_at  timestamptz not null default now()
);

insert into potluck.settings (id) values (true);

create table potluck_private.config (
  key   text primary key,
  value text not null
);

alter table potluck.dishes         enable row level security;
alter table potluck.settings        enable row level security;
alter table potluck_private.config  enable row level security;

-- ---------------------------------------------------------------------------
-- Internal helpers (potluck schema — never exposed through PostgREST)
-- ---------------------------------------------------------------------------

create or replace function potluck.is_host(p_host text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_host, '') <> '' and exists (
    select 1 from potluck_private.config
    where key = 'host_secret' and value = p_host
  );
$$;

create or replace function potluck.dish_json(d potluck.dishes, p_owner uuid)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id',        d.id,
    'name',      d.name,
    'category',  d.category,
    'servings',  d.servings,
    'broughtBy', d.brought_by,
    'mine',      (d.owner_id is not null and d.owner_id = p_owner),
    'createdAt', d.created_at,
    'updatedAt', d.updated_at
  );
$$;

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

create trigger dishes_touch_updated_at
  before update on potluck.dishes
  for each row execute function potluck.touch_updated_at();

create trigger settings_touch_updated_at
  before update on potluck.settings
  for each row execute function potluck.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPC API (public schema, potluck_ prefixed — the only reachable surface)
-- ---------------------------------------------------------------------------

create or replace function public.potluck_list_dishes(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(potluck.dish_json(d, p_owner) order by d.created_at desc, d.id desc),
    '[]'::jsonb
  )
  from potluck.dishes d;
$$;

create or replace function public.potluck_create_dish(
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
  d potluck.dishes;
begin
  if p_owner is null then
    raise exception 'owner_required';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required';
  end if;

  insert into potluck.dishes (name, category, servings, brought_by, owner_id)
  values (
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
  p_host             text default null,
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
begin
  select * into d from potluck.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  if not ((d.owner_id is not null and d.owner_id = p_owner) or potluck.is_host(p_host)) then
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
  where id = p_id
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
  p_host  text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d potluck.dishes;
begin
  select * into d from potluck.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  if not ((d.owner_id is not null and d.owner_id = p_owner) or potluck.is_host(p_host)) then
    raise exception 'not_allowed';
  end if;

  delete from potluck.dishes where id = p_id;
end;
$$;

create or replace function public.potluck_get_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('guestCount', s.guest_count, 'updatedAt', s.updated_at)
  from potluck.settings s
  where s.id = true;
$$;

create or replace function public.potluck_set_guest_count(p_count integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s potluck.settings;
begin
  if p_count is null or p_count < 0 or p_count > 9999 then
    raise exception 'guest_count_out_of_range';
  end if;

  insert into potluck.settings (id, guest_count)
  values (true, p_count)
  on conflict (id) do update set guest_count = excluded.guest_count
  returning * into s;

  return jsonb_build_object('guestCount', s.guest_count, 'updatedAt', s.updated_at);
end;
$$;

create or replace function public.potluck_verify_host(p_host text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select potluck.is_host(p_host);
$$;

-- ---------------------------------------------------------------------------
-- Grants — SCOPED to potluck functions only. Never a blanket public revoke.
-- ---------------------------------------------------------------------------

revoke execute on function
  public.potluck_list_dishes(uuid),
  public.potluck_create_dish(uuid, text, text, integer, text),
  public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean),
  public.potluck_claim_dish(uuid, uuid, text),
  public.potluck_delete_dish(uuid, uuid, text),
  public.potluck_get_settings(),
  public.potluck_set_guest_count(integer),
  public.potluck_verify_host(text)
from public;

grant execute on function
  public.potluck_list_dishes(uuid),
  public.potluck_create_dish(uuid, text, text, integer, text),
  public.potluck_update_dish(uuid, uuid, text, text, text, integer, text, boolean),
  public.potluck_claim_dish(uuid, uuid, text),
  public.potluck_delete_dish(uuid, uuid, text),
  public.potluck_get_settings(),
  public.potluck_set_guest_count(integer),
  public.potluck_verify_host(text)
to anon, authenticated;
