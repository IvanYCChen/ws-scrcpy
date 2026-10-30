# ---------- Build stage ----------
FROM node:24-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .
# `npm run dist` builds the server, the classic UI and the admin UI (admin/ installs its own deps).
RUN --mount=type=cache,target=/root/.npm \
    npm run dist \
 && npm prune --omit=dev

# ---------- Runtime stage ----------
FROM node:24-bookworm-slim
ENV NODE_ENV=production

RUN apt-get update \
 && apt-get install -y --no-install-recommends adb tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./

USER node
EXPOSE 8000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
