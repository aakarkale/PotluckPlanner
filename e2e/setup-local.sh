#!/usr/bin/env bash
# Prepares the local database for E2E tests: fresh potluck_e2e DB with every
# production migration applied in order, plus PostgREST-style roles. The REST
# gateway itself is emulated by rest-shim.mjs (started by Playwright).
# Idempotent — safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

DB=potluck_e2e

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

# Apply every migration in order — the local rig always mirrors the full
# migration history of the production project.
for migration in ../supabase/migrations/*.sql; do
  echo "applying $(basename "${migration}")"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} -f "${migration}"
done

sudo -u postgres psql -v ON_ERROR_STOP=1 -q -d ${DB} \
  -c "grant connect on database ${DB} to authenticator;"

echo "Database ${DB} ready."
