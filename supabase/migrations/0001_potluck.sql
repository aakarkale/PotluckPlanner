-- Potluck Tracker — schema + RPC API.
--
-- Security model: both tables are RLS-enabled with NO policies (deny-all).
-- The browser talks to the database exclusively through the SECURITY DEFINER
-- functions below, using the publishable (anon) key. The raw owner_id of a
-- dish never leaves the database; every function that returns dishes computes
-- a per-caller `mine` boolean instead, so clients cannot spoof identity by
-- reading another dish's owner. Host powers are granted by presenting a
-- secret that is compared against private.config inside the database.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.dishes (
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

-- Singleton settings row keyed by `id = true` so guest count is one upsert away.
create table public.settings (
  id          boolean primary key default true constraint settings_singleton check (id),
  guest_count integer not null default 20
              constraint settings_guest_count_range check (guest_count between 0 and 9999),
  updated_at  timestamptz not null default now()
);

insert into public.settings (id) values (true);

-- Private schema: never exposed through the API.
create schema private;

create table private.config (
  key   text primary key,
  value text not null
);

alter table public.dishes  enable row level security;
alter table public.settings enable row level security;
alter table private.config enable row level security;

revoke all on public.dishes   from anon, authenticated;
revoke all on public.settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (private schema — not callable through the API)
-- ---------------------------------------------------------------------------

create or replace function private.is_host(p_host text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_host, '') <> '' and exists (
    select 1 from private.config
    where key = 'host_secret' and value = p_host
  );
$$;

create or replace function private.dish_json(d public.dishes, p_owner uuid)
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

create or replace function private.touch_updated_at()
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
  before update on public.dishes
  for each row execute function private.touch_updated_at();

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RPC API (public schema — the only surface reachable with the anon key)
-- ---------------------------------------------------------------------------

create or replace function public.list_dishes(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(private.dish_json(d, p_owner) order by d.created_at desc, d.id desc),
    '[]'::jsonb
  )
  from public.dishes d;
$$;

create or replace function public.create_dish(
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
  d public.dishes;
begin
  if p_owner is null then
    raise exception 'owner_required';
  end if;
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required';
  end if;

  insert into public.dishes (name, category, servings, brought_by, owner_id)
  values (
    nullif(btrim(p_name), ''),
    p_category,
    p_servings,
    nullif(btrim(coalesce(p_brought_by, '')), ''),
    p_owner
  )
  returning * into d;

  return private.dish_json(d, p_owner);
end;
$$;

-- Partial update: null field parameters mean "leave unchanged".
-- Unclaiming (brought_by -> null) is expressed with p_clear_brought_by.
create or replace function public.update_dish(
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
  d public.dishes;
begin
  select * into d from public.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  if not ((d.owner_id is not null and d.owner_id = p_owner) or private.is_host(p_host)) then
    raise exception 'not_allowed';
  end if;

  update public.dishes
  set name       = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
      category   = coalesce(p_category, category),
      servings   = coalesce(p_servings, servings),
      brought_by = case
                     when p_clear_brought_by then null
                     else coalesce(nullif(btrim(coalesce(p_brought_by, '')), ''), brought_by)
                   end
  where id = p_id
  returning * into d;

  return private.dish_json(d, p_owner);
end;
$$;

-- Anyone may claim a dish that is currently unclaimed. The WHERE clause makes
-- concurrent claims race-safe: exactly one caller wins.
create or replace function public.claim_dish(
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
  d public.dishes;
begin
  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'name_required';
  end if;

  update public.dishes
  set brought_by = btrim(p_name)
  where id = p_id and brought_by is null
  returning * into d;

  if not found then
    if exists (select 1 from public.dishes where id = p_id) then
      raise exception 'already_claimed';
    end if;
    raise exception 'dish_not_found';
  end if;

  return private.dish_json(d, p_owner);
end;
$$;

create or replace function public.delete_dish(
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
  d public.dishes;
begin
  select * into d from public.dishes where id = p_id;
  if not found then
    raise exception 'dish_not_found';
  end if;

  if not ((d.owner_id is not null and d.owner_id = p_owner) or private.is_host(p_host)) then
    raise exception 'not_allowed';
  end if;

  delete from public.dishes where id = p_id;
end;
$$;

create or replace function public.get_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('guestCount', s.guest_count, 'updatedAt', s.updated_at)
  from public.settings s
  where s.id = true;
$$;

create or replace function public.set_guest_count(p_count integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.settings;
begin
  if p_count is null or p_count < 0 or p_count > 9999 then
    raise exception 'guest_count_out_of_range';
  end if;

  insert into public.settings (id, guest_count)
  values (true, p_count)
  on conflict (id) do update set guest_count = excluded.guest_count
  returning * into s;

  return jsonb_build_object('guestCount', s.guest_count, 'updatedAt', s.updated_at);
end;
$$;

-- Lets a device holding ?host=<secret> confirm the secret before persisting
-- host mode. Returns false whenever host mode is disabled (no secret stored).
create or replace function public.verify_host(p_host text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_host(p_host);
$$;

-- ---------------------------------------------------------------------------
-- Grants: deny by default, then allow exactly the RPC surface.
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

-- Seal the private schema outright (Supabase's default privileges are
-- permissive; none of this must ever be reachable through the API roles).
revoke all on schema private from public;
revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

grant execute on function
  public.list_dishes(uuid),
  public.create_dish(uuid, text, text, integer, text),
  public.update_dish(uuid, uuid, text, text, text, integer, text, boolean),
  public.claim_dish(uuid, uuid, text),
  public.delete_dish(uuid, uuid, text),
  public.get_settings(),
  public.set_guest_count(integer),
  public.verify_host(text)
to anon, authenticated;
