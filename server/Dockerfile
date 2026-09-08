# syntax=docker/dockerfile:1

# Debian slim rather than Alpine on purpose: Prisma's query and schema engines
# link against glibc here. Targeting musl would additionally require
# `binaryTargets = ["native", "linux-musl-openssl-3.0.x"]` in schema.prisma,
# and mismatches there surface only at runtime. ~40MB buys that away.
FROM node:24-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app


# --- dependencies (full, including dev) ------------------------------------
# Also the stage docker-compose.dev.yml targets, so it holds the Nest CLI.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "start:dev"]


# --- build -----------------------------------------------------------------
FROM deps AS build
RUN npx prisma generate && npm run build


# --- production dependencies ------------------------------------------------
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# --ignore-scripts: @prisma/client's postinstall would try to generate against
# a schema that is not in this stage. The generated client is copied from
# `build` below instead.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force


# --- runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3001

# Ownership is set per COPY rather than by a trailing `chown -R`: a recursive
# chown over the dependency tree rewrites every file into a second full-size
# layer and cost ~3 minutes of build time.
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
# The generated client, plus the CLI and schema engine that `migrate deploy`
# needs at boot. `prisma` is a devDependency, so these come from `build`
# rather than dragging the whole dev tree into the image.
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=node:node /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node --chmod=755 docker-entrypoint.sh ./

USER node

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
