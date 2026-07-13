# syntax=docker/dockerfile:1
# Autoneum Capacity — obraz produkcyjny (API + zbudowany frontend React)
#
# Budowa:  docker build -t capacity-app .
# Uruchomienie:
#   docker run --rm -p 3001:3001 -v capacity-data:/data capacity-app
#   docker compose up --build -d
# Aplikacja: http://localhost:3001

FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS client-deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

FROM server-deps AS server-build
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM client-deps AS client-build
COPY client/tsconfig.json client/tsconfig.node.json client/index.html ./
COPY client/vite.config.ts client/vite.config.js client/vite.config.d.ts ./
COPY client/public ./public
COPY client/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app/server

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/data/capacity.db
ENV CLIENT_DIST=/app/client/dist
ENV DOCKER=1

RUN mkdir -p /data

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/src/db/migrations ./dist/db/migrations
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/settings').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
