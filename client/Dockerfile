# syntax=docker/dockerfile:1

# --- dependencies (full, including dev) ------------------------------------
# Also the stage docker-compose.dev.yml targets, so it holds the Vite CLI.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]


# --- build -----------------------------------------------------------------
# Vite inlines VITE_* at build time, same rebuild caveat as the Next.js app.
# Each falls back to a hardcoded default in client/src/config/ when empty.
FROM deps AS build
ARG VITE_REOWN_PROJECT_ID=
ARG VITE_UNIPAY_TREASURY_ADDRESS=
ARG VITE_UNIPAY_TESTNET_TREASURY_ADDRESS=
ENV VITE_REOWN_PROJECT_ID=$VITE_REOWN_PROJECT_ID
ENV VITE_UNIPAY_TREASURY_ADDRESS=$VITE_UNIPAY_TREASURY_ADDRESS
ENV VITE_UNIPAY_TESTNET_TREASURY_ADDRESS=$VITE_UNIPAY_TESTNET_TREASURY_ADDRESS
RUN npm run build


# --- runtime ---------------------------------------------------------------
# The output is static, so the runtime needs a web server, not Node. Coolify's
# proxy still sits in front of this; nginx is what actually serves the files
# and provides the SPA fallback.
FROM nginx:alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
