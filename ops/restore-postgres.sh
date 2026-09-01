#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
BACKUP_FILE="${1:-}"

[[ -n "$BACKUP_FILE" && -f "$BACKUP_FILE" ]] || { echo "Usage: CONFIRM_RESTORE=YES bash ops/restore-postgres.sh /path/to/backup.dump" >&2; exit 1; }
[[ "${CONFIRM_RESTORE:-}" == "YES" ]] || { echo "Set CONFIRM_RESTORE=YES to acknowledge destructive restore" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

echo "[restore] creating pre-restore safety backup"
bash ops/backup-postgres.sh >/tmp/behshahr-pre-restore-backup.txt
cat /tmp/behshahr-pre-restore-backup.txt

echo "[restore] stopping application traffic"
"${COMPOSE[@]}" stop customer courier admin api caddy

REMOTE_FILE="/tmp/behshahr-restore.dump"
"${COMPOSE[@]}" cp "$BACKUP_FILE" "postgres:${REMOTE_FILE}" >/dev/null

cleanup() {
  "${COMPOSE[@]}" exec -T postgres rm -f "$REMOTE_FILE" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[restore] validating archive"
"${COMPOSE[@]}" exec -T postgres pg_restore --list "$REMOTE_FILE" >/dev/null

echo "[restore] recreating database"
"${COMPOSE[@]}" exec -T postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='behshahr_delivery' AND pid <> pg_backend_pid();" >/dev/null
"${COMPOSE[@]}" exec -T postgres dropdb -U postgres --if-exists behshahr_delivery
"${COMPOSE[@]}" exec -T postgres createdb -U postgres behshahr_delivery

"${COMPOSE[@]}" exec -T postgres pg_restore \
  -U postgres -d behshahr_delivery --no-owner --no-privileges --exit-on-error "$REMOTE_FILE"

# Bring the restored database up to the schema expected by the checked-out release.
"${COMPOSE[@]}" run --rm migrate

"${COMPOSE[@]}" up -d api customer courier admin caddy

for attempt in {1..30}; do
  if "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
    echo "[restore] restore complete and API healthy"
    exit 0
  fi
  sleep 2
done

echo "[restore] API did not become healthy after restore" >&2
exit 1
