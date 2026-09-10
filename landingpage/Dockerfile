# syntax=docker/dockerfile:1

# Bun rather than Node: the project is locked with bun.lock, and serve.ts runs
# under Bun directly with no separate TypeScript compile step.
FROM oven/bun:1.3.14-alpine AS base
WORKDIR /app


# --- dependencies (full, including dev) ------------------------------------
# Also the stage docker-compose.dev.yml targets, so it holds the Vite CLI.
FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["bun", "run", "dev", "--host", "0.0.0.0", "--port", "3000"]


# --- build -----------------------------------------------------------------
FROM deps AS build
# Vite inlines VITE_* at build time, so these are build args, not runtime env.
# Left empty, each falls back to its localhost default in src/routes/index.tsx.
ARG VITE_CLIENT_URL=
ARG VITE_BUSINESS_URL=
ENV VITE_CLIENT_URL=$VITE_CLIENT_URL
ENV VITE_BUSINESS_URL=$VITE_BUSINESS_URL
RUN bun run build


# --- production dependencies ------------------------------------------------
# The SSR bundle imports react, @tanstack/* and friends at runtime rather than
# inlining them, so the runtime still needs a (pruned) node_modules.
FROM base AS prod-deps
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --production


# --- runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=prod-deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=build --chown=bun:bun /app/dist ./dist
COPY --chown=bun:bun package.json serve.ts ./

USER bun
EXPOSE 3000
CMD ["bun", "serve.ts"]
