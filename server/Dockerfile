# Codex's online server (D-262). Built from the release folder made by
# `npm run deploy:bundle` (context = that folder: server/ and shared/ side by side).
FROM node:24-alpine

ENV NODE_ENV=production
WORKDIR /srv/codex

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev && npm cache clean --force

COPY shared ./shared
COPY server/src ./server/src

# Not root inside the container.
USER node
WORKDIR /srv/codex/server
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/index.ts"]
