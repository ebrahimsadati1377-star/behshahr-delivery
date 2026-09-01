#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

bash ops/preflight.sh

if [[ -n "$("${COMPOSE[@]}" ps -q postgres 2>/dev/null || true)" && "${SKIP_BACKUP:-0}" != "1" ]]; then
  echo "[deploy] existing database detected; taking pre-deploy backup"
  bash ops/backup-postgres.sh
fi

echo "[deploy] building production images"
"${COMPOSE[@]}" build --pull api customer courier admin migrate

echo "[deploy] starting database and redis"
"${COMPOSE[@]}" up -d postgres redis

for attempt in {1..30}; do
  pg_state="$("${COMPOSE[@]}" ps --format json postgres 2>/dev/null || true)"
  redis_state="$("${COMPOSE[@]}" ps --format json redis 2>/dev/null || true)"
  if [[ "$pg_state" == *'"Health":"healthy"'* && "$redis_state" == *'"Health":"healthy"'* ]]; then
    break
  fi
  sleep 2
done

echo "[deploy] applying database migrations"
"${COMPOSE[@]}" run --rm migrate

echo "[deploy] starting application and HTTPS proxy"
"${COMPOSE[@]}" up -d --remove-orphans api customer courier admin caddy

for attempt in {1..45}; do
  if SKIP_PUBLIC_HEALTH=1 bash ops/healthcheck.sh >/dev/null 2>&1; then
    echo "[deploy] internal health passed"
    break
  fi
  if [[ "$attempt" == "45" ]]; then
    "${COMPOSE[@]}" ps
    "${COMPOSE[@]}" logs --tail=120 api customer courier admin caddy
    echo "[deploy] internal health failed" >&2
    exit 1
  fi
  sleep 2
done

echo "[deploy] waiting for public HTTPS/DNS readiness"
for attempt in {1..30}; do
  if bash ops/healthcheck.sh >/dev/null 2>&1; then
    echo "[deploy] production deploy healthy"
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 5
done

echo "[deploy] app is internally healthy but public HTTPS checks did not pass yet" >&2
echo "[deploy] verify DNS records and firewall ports 80/443, then run: bash ops/healthcheck.sh" >&2
exit 2
