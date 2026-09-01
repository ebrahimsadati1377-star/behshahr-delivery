#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"

fail() { echo "[preflight] ERROR: $*" >&2; exit 1; }
info() { echo "[preflight] $*"; }

command -v docker >/dev/null 2>&1 || fail "docker is not installed"
docker compose version >/dev/null 2>&1 || fail "docker compose v2 is not available"
[[ -f "$ENV_FILE" ]] || fail "$ENV_FILE not found; copy ops/production.env.example and fill it on the server"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(
  CUSTOMER_DOMAIN COURIER_DOMAIN ADMIN_DOMAIN ACME_EMAIL
  POSTGRES_PASSWORD DATABASE_URL OTP_SECRET JWT_ACCESS_SECRET JWT_REFRESH_SECRET
  IPPANEL_API_KEY IPPANEL_FROM_NUMBER IPPANEL_OTP_PATTERN_CODE
  NESHAN_SERVICE_API_KEY NEXT_PUBLIC_NESHAN_MAP_KEY
)

for name in "${required[@]}"; do
  value="${!name:-}"
  [[ -n "$value" ]] || fail "$name is empty"
  [[ "$value" != *"replace"* ]] || fail "$name still contains a placeholder"
  [[ "$value" != *"example.com"* ]] || fail "$name still uses example.com"
done

for name in OTP_SECRET JWT_ACCESS_SECRET JWT_REFRESH_SECRET; do
  value="${!name}"
  (( ${#value} >= 32 )) || fail "$name must be at least 32 characters"
done

[[ "$DATABASE_URL" == postgresql://* ]] || fail "DATABASE_URL must be a PostgreSQL URL"
[[ "${ROUTING_PROVIDER:-neshan}" == "neshan" || "${ROUTING_PROVIDER:-neshan}" == "auto" ]] || fail "production routing must be neshan or auto"

if [[ "$CUSTOMER_DOMAIN" == "$COURIER_DOMAIN" || "$CUSTOMER_DOMAIN" == "$ADMIN_DOMAIN" || "$COURIER_DOMAIN" == "$ADMIN_DOMAIN" ]]; then
  fail "customer, courier, and admin domains must be distinct"
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet
info "compose configuration is valid"
info "secret placeholders and required production settings are valid"
info "preflight passed"
