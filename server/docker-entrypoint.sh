#!/bin/sh
# Apply any pending migrations, then hand off to the app.
#
# Compose gates this container on `postgres` being healthy, which includes its
# credentials sync, so the database is reachable and accepts POSTGRES_PASSWORD
# by the time we get here. `migrate deploy` is idempotent and never generates or
# resets, which makes it safe to run on every restart and every replica.
#
# Invoked through `node` directly rather than the node_modules/.bin symlink,
# which does not survive being copied between build stages.
set -e

# DATABASE_URL is always built here from the same POSTGRES_* values the postgres
# service uses, and any inherited value is overwritten: one copy of the
# credentials, so the two services cannot disagree. Prisma and the Nest config
# both read the exported variable.
# encodeURIComponent: a password containing @ : / # would otherwise corrupt
# the URL.
DATABASE_URL=$(node -e '
  const e = process.env, enc = encodeURIComponent;
  if (!e.POSTGRES_PASSWORD) {
    console.error("[entrypoint] POSTGRES_PASSWORD is not set");
    process.exit(1);
  }
  const user = enc(e.POSTGRES_USER || "postgres");
  const pass = enc(e.POSTGRES_PASSWORD);
  const db = enc(e.POSTGRES_DB || "unipay");
  process.stdout.write(`postgresql://${user}:${pass}@postgres:5432/${db}?schema=public`);
')
export DATABASE_URL

echo "[entrypoint] applying database migrations..."
if ! node ./node_modules/prisma/build/index.js migrate deploy; then
  echo "[entrypoint] migrations failed; check the postgres service logs for a [sync-credentials] line" >&2
  exit 1
fi

echo "[entrypoint] starting: $*"
exec "$@"
