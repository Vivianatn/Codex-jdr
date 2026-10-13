# Codex's online server (D-262, D-263). Built from the release folder made by
# `npm run deploy:bundle` (context = that folder; the server is already compiled).
FROM node:22-alpine

ENV NODE_ENV=production
# Caddy serves the site in this setup.
ENV CODEX_SERVE_SITE=false
WORKDIR /srv/codex/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server/dist ./dist

# Not root inside the container.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "dist/server/src/index.js"]
