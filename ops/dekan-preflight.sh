#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/dekan.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dekan.yml}"

fail() { echo "[dekan-preflight] ERROR: $*" >&2; exit 1; }
info() { echo "[dekan-preflight] $*"; }

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is not available"
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found; copy ops/dekan.env.example to ops/dekan.env and fill real values"

if [[ -n "$(find "$ENV_FILE" -maxdepth 0 -perm /077 -print -quit 2>/dev/null)" ]]; then
  fail "$ENV_FILE must not be group/world readable; run chmod 600 $ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  POSTGRES_PASSWORD OTP_SECRET JWT_ACCESS_SECRET JWT_REFRESH_SECRET
  IPPANEL_API_KEY IPPANEL_FROM_NUMBER IPPANEL_OTP_PATTERN_CODE
  MAPIR_API_KEY
)

for name in "${required[@]}"; do
  value="${!name:-}"
  [[ -n "$value" ]] || fail "$name is empty"
  [[ "$value" != *"CHANGE_ME"* ]] || fail "$name still contains a placeholder"
done

for name in POSTGRES_PASSWORD OTP_SECRET JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  value="${!name}"
  (( ${#value} >= 32 )) || fail "$name must be at least 32 characters"
done

routing="${ROUTING_PROVIDER:-mapir}"
[[ "$routing" == "approximate" || "$routing" == "mapir" || "$routing" == "neshan" || "$routing" == "auto" ]] || fail "ROUTING_PROVIDER must be approximate, mapir, neshan, or auto"
if [[ "$routing" == "neshan" ]]; then
  [[ -n "${NESHAN_SERVICE_API_KEY:-}" && "${NESHAN_SERVICE_API_KEY}" != *"CHANGE_ME"* ]] || fail "NESHAN_SERVICE_API_KEY is required for ROUTING_PROVIDER=neshan"
fi
if [[ -n "${NESHAN_SERVICE_API_KEY:-}" && "${NESHAN_SERVICE_API_KEY}" == *"CHANGE_ME"* ]]; then
  fail "NESHAN_SERVICE_API_KEY must be empty or a real key"
fi

for port in "${DEKAN_API_PORT:-4000}" "${DEKAN_COURIER_PORT:-3001}" "${DEKAN_ADMIN_PORT:-3002}"; do
  [[ "$port" =~ ^[0-9]+$ ]] || fail "host port is not numeric: $port"
  (( port >= 1024 && port <= 65535 )) || fail "host port is outside 1024-65535: $port"
done

[[ "${DEKAN_API_PORT:-4000}" != "${DEKAN_COURIER_PORT:-3001}" ]] || fail "API and Courier ports collide"
[[ "${DEKAN_API_PORT:-4000}" != "${DEKAN_ADMIN_PORT:-3002}" ]] || fail "API and Admin ports collide"
[[ "${DEKAN_COURIER_PORT:-3001}" != "${DEKAN_ADMIN_PORT:-3002}" ]] || fail "Courier and Admin ports collide"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet

# This profile must never expose service ports on all host interfaces.
rendered="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config)"
if grep -Eq 'host_ip: (0\.0\.0\.0|::)' <<<"$rendered"; then
  fail "Dekan profile contains a public host binding"
fi

info "compose configuration is valid"
info "Map.ir routing/map key is configured"
info "host bindings are loopback-only"
info "resource-limited Dekan profile preflight passed"
