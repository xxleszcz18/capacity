# syntax=docker/dockerfile:1
# =============================================================================
# Autoneum Capacity — obraz produkcyjny (Express API + React UI)
# =============================================================================
#
# Stack: Node 22 · Express · sql.js (SQLite w pamięci + zapis pliku) · Vite/React
#
# Budowa:
#   docker build -t capacity-app .
#
# Uruchomienie (zalecane przez Compose):
#   docker compose up --build -d
#
# Ręcznie:
#   docker run --rm -p 3001:3001 \
#     -e STORAGE_BASE_DIR=/data \
#     -e DB_PATH=/data/capacity.db \
#     -v capacity-data:/data \
#     capacity-app
#
# Aplikacja: http://localhost:3001
# Instrukcja: Administracja → Instrukcja obsługi (PL / EN / DE)
#
# Katalog danych w kontenerze (/data = STORAGE_BASE_DIR):
#   capacity.db          — baza SQLite
#   backups/             — backupy (Ustawienia administracyjne → lokalizacja: backups)
#   attachments/         — załączniki projektów (ścieżka: attachments)
#   call-offs/           — pliki SAP SalesFcst i raporty unmatched
#
# Po starcie w UI ustaw ścieżki względne względem /data (lub użyj
# „Przeglądaj na serwerze”). Okno Windows „Wskaż lokalizację” jest wyłączone
# (DOCKER=1).
# =============================================================================

# --- zależności serwera ---
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

# --- zależności klienta ---
FROM node:22-bookworm-slim AS client-deps
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

# --- build API (TypeScript → dist) ---
FROM server-deps AS server-build
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# --- build UI (Vite → client/dist) ---
FROM client-deps AS client-build
COPY client/tsconfig.json client/tsconfig.node.json client/index.html ./
COPY client/vite.config.ts client/vite.config.js client/vite.config.d.ts ./
COPY client/public ./public
COPY client/src ./src
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS production
WORKDIR /app/server

ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/capacity.db \
    STORAGE_BASE_DIR=/data \
    CLIENT_DIST=/app/client/dist \
    DOCKER=1 \
    AUTH_ENFORCE=1 \
    CALCULATOR_CACHE=1 \
    CALCULATOR_CACHE_TTL_MS=45000 \
    APP_BASE_URL=http://localhost:3001 \
    PASSWORD_RESET_TTL_HOURS=24

RUN mkdir -p /data/backups /data/attachments /data/call-offs

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# skompilowany backend + migracje SQL (czytane w runtime z dist/db/migrations)
COPY --from=server-build /app/server/dist ./dist
COPY --from=server-build /app/server/src/db/migrations ./dist/db/migrations

# zbudowany frontend (serwowany przez Express)
COPY --from=client-build /app/client/dist /app/client/dist

EXPOSE 3001
VOLUME ["/data"]

# Healthcheck bez auth (statyczny UI / SPA)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Upewnij się, że katalogi storage istnieją po montowaniu wolumenów
CMD ["sh", "-c", "mkdir -p /data/backups /data/attachments /data/call-offs && exec node dist/index.js"]
