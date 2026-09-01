#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

BACKUP_DIR="${BACKUP_DIR:-/var/backups/behshahr-delivery}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FINAL="$BACKUP_DIR/behshahr_delivery_${STAMP}.dump"
TMP="${FINAL}.partial"
CHECKSUM="${FINAL}.sha256"

cleanup() { rm -f "$TMP"; }
trap cleanup EXIT

echo "[backup] creating $FINAL"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U postgres -d behshahr_delivery --format=custom --compress=6 --no-owner --no-privileges > "$TMP"

[[ -s "$TMP" ]] || { echo "[backup] dump is empty" >&2; exit 1; }
mv "$TMP" "$FINAL"
sha256sum "$FINAL" > "$CHECKSUM"
chmod 600 "$FINAL" "$CHECKSUM"

# Validate that PostgreSQL can read the custom archive before reporting success.
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" cp "$FINAL" postgres:/tmp/backup-check.dump >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore --list /tmp/backup-check.dump >/dev/null
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres rm -f /tmp/backup-check.dump

find "$BACKUP_DIR" -type f \( -name 'behshahr_delivery_*.dump' -o -name 'behshahr_delivery_*.dump.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

echo "[backup] verified: $FINAL"
echo "$FINAL"
