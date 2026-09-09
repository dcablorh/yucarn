#!/bin/sh
# Start Postgres, then make the stored credentials match the environment.
#
# The stock entrypoint applies POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB only
# while initialising an empty volume. Every later boot ignores them, so a
# password changed in the deployment environment never reaches the database and
# the server fails with P1000. This runs after every boot and makes the
# environment the source of truth:
#   - the role exists, can log in, and has POSTGRES_PASSWORD
#   - the database exists
# The compose healthcheck waits for the marker file written at the end, so the
# server never connects before the sync has happened.
set -eu

: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
user="${POSTGRES_USER:-postgres}"
db="${POSTGRES_DB:-$user}"
marker=/tmp/.credentials-synced

# The container filesystem survives `docker restart`, so clear the previous
# boot's marker before anything else.
rm -f "$marker"

docker-entrypoint.sh "$@" &
pg_pid=$!
trap 'kill -INT "$pg_pid" 2>/dev/null || true' INT TERM

# Wait on TCP, not the socket. On first boot the stock entrypoint runs a
# temporary socket-only server to create the role and database; acting then
# would race its CREATE DATABASE. Only the real server listens on TCP.
# -U/-d only name the probe's login; without them it logs a FATAL for "root".
until pg_isready -q -h 127.0.0.1 -p 5432 -U "$user" -d postgres; do
  if ! kill -0 "$pg_pid" 2>/dev/null; then
    wait "$pg_pid"
    exit $?
  fi
  sleep 1
done

# Over the unix socket, where the image's pg_hba.conf trusts local connections,
# so this works whatever password the volume currently holds. The values are
# read with \getenv rather than passed as -v arguments, keeping the password
# out of the process list.
sync_as() {
  psql -X -q -v ON_ERROR_STOP=1 -h /var/run/postgresql -U "$1" -d postgres <<'SQL'
\getenv user POSTGRES_USER
\getenv pw POSTGRES_PASSWORD
\getenv db POSTGRES_DB
SELECT format('CREATE ROLE %I WITH SUPERUSER LOGIN', :'user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'user') \gexec
ALTER ROLE :"user" WITH LOGIN PASSWORD :'pw';
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SQL
}

# \getenv needs the variables exported even when they fell back to defaults.
export POSTGRES_USER="$user" POSTGRES_DB="$db"

# Connect as the configured role; if the volume was created under a different
# POSTGRES_USER that role does not exist yet, so fall back to the stock
# superuser and create it from there.
if sync_as "$user" 2>/dev/null || { [ "$user" != postgres ] && sync_as postgres; }; then
  touch "$marker"
  echo "[sync-credentials] role \"$user\" and database \"$db\" match the environment"
else
  echo "[sync-credentials] ERROR: could not sync credentials; the healthcheck will stay unhealthy" >&2
fi

set +e
wait "$pg_pid"
status=$?
# A trapped signal interrupts `wait` early; wait again for the real exit code.
if kill -0 "$pg_pid" 2>/dev/null; then
  wait "$pg_pid"
  status=$?
fi
exit "$status"
