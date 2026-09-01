#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/dekan.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dekan.yml}"

export ENV_FILE COMPOSE_FILE
bash ops/dekan-preflight.sh

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "[dekan-deploy] building API, Courier and Admin images"
"${compose[@]}" build api courier admin migrate

echo "[dekan-deploy] starting PostgreSQL and Redis"
"${compose[@]}" up -d postgres redis

echo "[dekan-deploy] applying database migrations"
"${compose[@]}" run --rm migrate

echo "[dekan-deploy] starting application services"
"${compose[@]}" up -d api courier admin

for attempt in {1..45}; do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:${DEKAN_API_PORT:-4000}/api/health" >/dev/null \
    && curl --fail --silent --max-time 3 "http://127.0.0.1:${DEKAN_COURIER_PORT:-3001}/" >/dev/null \
    && curl --fail --silent --max-time 3 "http://127.0.0.1:${DEKAN_ADMIN_PORT:-3002}/" >/dev/null; then
    echo "[dekan-deploy] local health checks passed"
    "${compose[@]}" ps
    exit 0
  fi
  sleep 2
done

"${compose[@]}" ps
"${compose[@]}" logs --tail=150 api courier admin postgres redis >&2
echo "[dekan-deploy] ERROR: local health checks did not become ready" >&2
exit 1
