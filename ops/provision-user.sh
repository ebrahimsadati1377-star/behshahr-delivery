#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
PHONE="${1:-}"
ROLE="${2:-}"
VEHICLE="${3:-}"

usage() {
  echo "Usage:" >&2
  echo "  bash ops/provision-user.sh +98912XXXXXXX ADMIN" >&2
  echo "  bash ops/provision-user.sh +98912XXXXXXX COURIER MOTORBIKE|CAR" >&2
  exit 1
}

[[ "$PHONE" =~ ^\+989[0-9]{9}$ ]] || usage
[[ "$ROLE" == "ADMIN" || "$ROLE" == "COURIER" ]] || usage
if [[ "$ROLE" == "COURIER" ]]; then
  [[ "$VEHICLE" == "MOTORBIKE" || "$VEHICLE" == "CAR" ]] || usage
fi
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

if [[ "$ROLE" == "ADMIN" ]]; then
  "${COMPOSE[@]}" exec -T postgres psql -U postgres -d behshahr_delivery \
    -v ON_ERROR_STOP=1 -v phone="$PHONE" <<'SQL'
INSERT INTO users (id, phone, role, status, created_at, updated_at)
VALUES (gen_random_uuid(), :'phone', 'ADMIN', 'ACTIVE', NOW(), NOW())
ON CONFLICT (phone) DO UPDATE
SET role='ADMIN', status='ACTIVE', updated_at=NOW();
SQL
  echo "[provision] ADMIN ready: $PHONE"
  exit 0
fi

"${COMPOSE[@]}" exec -T postgres psql -U postgres -d behshahr_delivery \
  -v ON_ERROR_STOP=1 -v phone="$PHONE" -v vehicle="$VEHICLE" <<'SQL'
WITH upsert_user AS (
  INSERT INTO users (id, phone, role, status, created_at, updated_at)
  VALUES (gen_random_uuid(), :'phone', 'COURIER', 'ACTIVE', NOW(), NOW())
  ON CONFLICT (phone) DO UPDATE
  SET role='COURIER', status='ACTIVE', updated_at=NOW()
  RETURNING id
)
INSERT INTO couriers (id, user_id, vehicle_type, status, created_at, updated_at)
SELECT gen_random_uuid(), id, :'vehicle'::"VehicleType", 'OFFLINE', NOW(), NOW()
FROM upsert_user
ON CONFLICT (user_id) DO UPDATE
SET vehicle_type=EXCLUDED.vehicle_type, status='OFFLINE', updated_at=NOW();
SQL

echo "[provision] COURIER ready: $PHONE ($VEHICLE)"
