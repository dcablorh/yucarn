#!/bin/sh
# Apply any pending migrations, then hand off to the app.
#
# Compose gates this container on `postgres` being healthy, so the database is
# reachable by the time we get here. `migrate deploy` is idempotent and never
# generates or resets, which makes it safe to run on every restart and every
# replica.
#
# Invoked through `node` directly rather than the node_modules/.bin symlink,
# which does not survive being copied between build stages.
set -e

echo "[entrypoint] applying database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] starting: $*"
exec "$@"
