#!/bin/sh
# Development entrypoint: compile-on-change plus restart-on-change, as two
# separate jobs.
#
# This deliberately avoids `nest start --watch`. That command recompiles
# correctly, but it spawns the replacement process without terminating the
# previous one, so in a container every edit dies on EADDRINUSE while the stale
# process keeps serving old code. Splitting the responsibilities fixes it:
#
#   nest build --watch   src/ -> dist/, and nothing else
#   node --watch         owns the process, and kills the old one before rebinding
#
# `node --watch` has been stable since Node 22 and needs no extra dependency.
set -e

echo "[dev] generating prisma client..."
npx prisma generate

echo "[dev] applying database migrations..."
npx prisma migrate deploy

# The host's dist/ arrives through the bind mount and may have been built by a
# different platform or an older commit. Clearing it first also makes the wait
# below meaningful: nest-cli.json sets deleteOutDir, so the compiler wipes dist/
# on startup, and a leftover main.js would otherwise satisfy the wait
# immediately and hand node an entrypoint about to be deleted.
echo "[dev] clearing stale build output..."
rm -rf dist

echo "[dev] starting compiler in watch mode..."
npx nest build --watch &

echo "[dev] waiting for first compile..."
while [ ! -s dist/main.js ]; do sleep 1; done
# main.js exists, but the compiler may still be emitting the modules it
# requires. A short settle avoids racing a half-written tree on first boot.
sleep 2

echo "[dev] starting application in watch mode..."
exec node --watch --enable-source-maps dist/main
