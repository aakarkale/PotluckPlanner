#!/usr/bin/env bash
# Prepares the local database for E2E tests: fresh potluck_e2e DB with the
# production migration applied, PostgREST-style roles, and a test host secret.
# The REST gateway itself is emulated by rest-shim.mjs (started by Playwright).
# Idempotent — safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

DB=potluck_e2e
HOST_SECRET='test-host-secret'

sudo -u postgres psql -v ON_ERROR_STOP=1 -q <<SQL
drop database if exists ${DB} with (force);
do \$\$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login password 'postgres';
  end if;
  grant anon to authenticator;
end \$\$;
create database ${DB};
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} \
  -f ../supabase/migrations/0001_potluck.sql

sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} <<SQL
insert into private.config (key, value) values ('host_secret', '${HOST_SECRET}')
  on conflict (key) do update set value = excluded.value;
grant connect on database ${DB} to authenticator;
SQL

echo "Database ${DB} ready."
