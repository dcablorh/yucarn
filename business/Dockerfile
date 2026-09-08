# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /app


# --- dependencies (full, including dev) ------------------------------------
# Also the stage docker-compose.dev.yml targets, so it holds the Next.js CLI.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]


# --- build -----------------------------------------------------------------
# NEXT_PUBLIC_* is inlined into the client bundle by `next build`, so these are
# build args, not runtime env. Changing either one needs `docker compose build
# business`; a restart will not pick it up.
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_PRIVY_APP_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# --- runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Without this Next binds to localhost inside the container and nothing on the
# host or the compose network can reach it.
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=build /app/public ./public
# `standalone` carries its own minimal server.js and node_modules; static
# assets and public/ are deliberately left out of it and copied alongside.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
