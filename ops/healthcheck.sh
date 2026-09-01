#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-ops/production.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
failures=()

check_container() {
  local service="$1"
  local cid
  cid="$("${COMPOSE[@]}" ps -q "$service")"
  if [[ -z "$cid" ]]; then
    failures+=("$service is not running")
    return
  fi
  local state
  state="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
  [[ "$state" == "running" ]] || failures+=("$service state=$state")
}

for service in postgres redis api customer courier admin caddy; do
  check_container "$service"
done

if ! "${COMPOSE[@]}" exec -T api node -e "fetch('http://127.0.0.1:4000/api/health').then(async r=>{const b=await r.json().catch(()=>({})); if(!r.ok || b.status!=='ok') process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
  failures+=("API dependency health failed")
fi

check_public() {
  local domain="$1"
  local label="$2"
  if ! curl --fail --silent --show-error --max-time 10 "https://${domain}/" >/dev/null 2>&1; then
    failures+=("$label public HTTPS failed: $domain")
  fi
}

if [[ "${SKIP_PUBLIC_HEALTH:-0}" != "1" ]]; then
  check_public "$CUSTOMER_DOMAIN" customer
  check_public "$COURIER_DOMAIN" courier
  check_public "$ADMIN_DOMAIN" admin
fi

if (( ${#failures[@]} > 0 )); then
  message="Behshahr Delivery health failure: $(IFS='; '; echo "${failures[*]}")"
  echo "[health] $message" >&2

  if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    node -e "fetch(process.env.ALERT_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({service:'behshahr-delivery',status:'down',message:process.argv[1],at:new Date().toISOString()})}).catch(()=>{})" "$message" || true
  fi
  exit 1
fi

echo "[health] all production checks passed"
