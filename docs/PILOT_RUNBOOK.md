# Behshahr Delivery Pilot Runbook

This runbook is for the first controlled production pilot. It assumes one Ubuntu 24.04 host running Docker Compose, PostGIS, Redis, the API, Customer PWA, Courier PWA, Admin Web, and Caddy.

## 1. Production host

Recommended minimum for the controlled pilot:

- Ubuntu 24.04 LTS
- 2 vCPU minimum; 4 vCPU preferred
- 4 GB RAM minimum; 8 GB preferred
- 40 GB SSD minimum
- Docker Engine + Docker Compose v2
- UTC system clock with NTP enabled
- SSH key authentication; password login disabled when possible

Install the repository at:

```text
/opt/behshahr-delivery
```

Only ports 80 and 443 should be public for the application. Restrict SSH/22 to trusted administration IPs when operationally possible. PostgreSQL, Redis, API, and the three application ports are intentionally not published by the production Compose file.

## 2. DNS

Create three distinct DNS records pointing at the production server:

- customer application domain
- courier application domain
- admin application domain

Wait until all three names resolve to the server before the final public-health stage. Caddy obtains and renews TLS certificates automatically after DNS and ports 80/443 are correct.

## 3. Production environment

Create the local-only environment file:

```bash
cp ops/production.env.example ops/production.env
chmod 600 ops/production.env
```

Fill every required value. Never commit this file. Required external credentials include:

- IPPanel API key, sender number, OTP pattern code
- Neshan Service API key
- Neshan Web Map key
- strong independent OTP/JWT secrets
- PostgreSQL password

Generate application secrets with a cryptographically secure command, for example:

```bash
openssl rand -hex 32
```

Run preflight before every first deployment or environment change:

```bash
ENV_FILE=ops/production.env bash ops/preflight.sh
```

Do not continue if preflight fails.

## 4. First deployment

From the checked-out release commit:

```bash
ENV_FILE=ops/production.env bash ops/deploy.sh
```

The deploy procedure:

1. validates environment and Compose configuration;
2. backs up an existing database when present;
3. builds production images;
4. starts PostGIS and Redis;
5. runs Prisma migrations once;
6. starts API and all three web applications;
7. starts Caddy;
8. verifies internal health and then public HTTPS.

A return code of `2` means application containers are internally healthy but public DNS/HTTPS is not ready yet. Check DNS/firewall and rerun:

```bash
bash ops/healthcheck.sh
```

## 5. Initial users

Provision the first administrator:

```bash
ENV_FILE=ops/production.env bash ops/provision-user.sh +989XXXXXXXXX ADMIN
```

Provision couriers explicitly with their actual vehicle:

```bash
ENV_FILE=ops/production.env bash ops/provision-user.sh +989XXXXXXXXX COURIER MOTORBIKE
ENV_FILE=ops/production.env bash ops/provision-user.sh +989XXXXXXXXX COURIER CAR
```

The script is idempotent. Re-running it updates the role/vehicle instead of creating duplicates.

Customers are created through the normal OTP flow and must not be pre-provisioned.

## 6. Admin configuration before accepting orders

In Admin Web, complete these before pilot traffic:

1. Create/verify an active MOTORBIKE pricing rule.
2. Create/verify an active CAR pricing rule if car delivery is offered.
3. Define the active Behshahr service zone.
4. Confirm at least one pilot courier can sign in, go AVAILABLE, and publish GPS.
5. Confirm order board, assignment, reassignment, and payment state are visible.

The pilot payment method is cash on delivery. Online payment must remain unavailable until a real payment gateway adapter is implemented and tested.

## 7. End-to-end field acceptance test

Perform this once on the production host before opening the pilot:

1. Customer requests a real IPPanel OTP and signs in.
2. Customer creates two addresses inside the service zone.
3. Customer obtains a quote; verify Neshan routing mode and plausible distance/ETA.
4. Customer creates a cash order.
5. Admin sees the order and assigns an AVAILABLE matching courier.
6. Customer receives the realtime assignment update.
7. Courier receives/currently sees the mission and GPS updates appear in tracking.
8. Courier marks pickup.
9. Courier marks delivered.
10. Admin records cash received; payment becomes PAID.
11. Customer detail shows DELIVERED and PAID.
12. Repeat with one order cancelled before assignment; payment must become CANCELLED.
13. Repeat assignment/reassignment once between two compatible couriers.

Do not launch the pilot if any required state transition needs a manual database change.

## 8. Backup automation

Install the included systemd units:

```bash
sudo cp ops/systemd/behshahr-backup.service /etc/systemd/system/
sudo cp ops/systemd/behshahr-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now behshahr-backup.timer
sudo systemctl list-timers behshahr-backup.timer
```

Backups default to `/var/backups/behshahr-delivery`, are checksum-protected and archive-validated, and retain 14 days by default.

Run one manual verified backup after first deployment:

```bash
sudo ENV_FILE=ops/production.env bash ops/backup-postgres.sh
```

Copy backups off-host regularly. A backup stored only on the production server is not sufficient disaster recovery.

## 9. Restore drill

A restore is destructive and requires explicit confirmation:

```bash
sudo CONFIRM_RESTORE=YES ENV_FILE=ops/production.env \
  bash ops/restore-postgres.sh /var/backups/behshahr-delivery/<backup>.dump
```

The restore script first takes a safety backup, stops application traffic, validates the archive, recreates the database, restores it, applies the checked-out release migrations, restarts the application, and waits for API health.

Perform a restore drill on a non-production copy before pilot launch and after material schema changes.

## 10. Health monitoring

Install the minute-level systemd health timer:

```bash
sudo cp ops/systemd/behshahr-health.service /etc/systemd/system/
sudo cp ops/systemd/behshahr-health.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now behshahr-health.timer
```

The health script checks container state/internal API health and public endpoints. If `ALERT_WEBHOOK_URL` is configured in the server environment used by the service, failures can be posted to that webhook.

Inspect failures with:

```bash
journalctl -u behshahr-health.service -n 100 --no-pager
docker compose --env-file ops/production.env -f docker-compose.production.yml ps
docker compose --env-file ops/production.env -f docker-compose.production.yml logs --tail=200 api customer courier admin caddy
```

## 11. Pilot load baseline

After API health is stable, run the bundled baseline from inside the API container:

```bash
docker compose --env-file ops/production.env -f docker-compose.production.yml exec -T api \
  env TOTAL_REQUESTS=1000 CONCURRENCY=50 MAX_P95_MS=750 MAX_ERROR_RATE=0.01 \
  node ops/load/health-load.mjs
```

This is an infrastructure/readiness baseline, not a substitute for later realistic order-flow performance testing. Any sustained error rate over 1% or p95 health latency above 750 ms is a pilot no-go until investigated.

## 12. Incident actions

### Public site unavailable

1. Run `bash ops/healthcheck.sh`.
2. Check Caddy and app container logs.
3. Verify DNS, ports 80/443, disk usage, memory, and certificate errors.
4. Do not expose internal application or database ports as a workaround.

### API unhealthy

1. Check PostGIS and Redis health.
2. Inspect API JSON logs by request ID.
3. Check external IPPanel/Neshan failures separately from DB/Redis failures.
4. If the release caused the failure, use rollback below.

### SMS failure

The OTP implementation releases code/cooldown state when IPPanel delivery fails. Confirm IPPanel credentials/pattern/sender and provider status before retrying. Never enable console OTP in production.

### Neshan routing failure

`ROUTING_PROVIDER=auto` may use the approximate fallback if Neshan is unavailable. Monitor this because prolonged fallback means prices/ETA are estimates. Use `neshan` mode if business policy requires refusing orders rather than fallback.

## 13. Release rollback

Before each deployment record the previous release commit and verified backup path.

Application rollback:

```bash
git checkout <previous-known-good-commit>
ENV_FILE=ops/production.env bash ops/deploy.sh
```

If a new database migration is not backward compatible with the previous code, application rollback alone is unsafe. Restore the pre-deploy backup using the restore procedure, then deploy the previous commit.

Never manually edit Prisma migration history on production.

## 14. Go / No-Go

Pilot is GO only when all are true:

- CI on the deployed commit is green.
- Production preflight passes.
- Public HTTPS works for customer/courier/admin domains.
- Real IPPanel OTP succeeds.
- Real Neshan route/map succeeds.
- Pricing and service zones are configured.
- At least two pilot couriers have completed sign-in/GPS/mission acceptance tests.
- Cash payment audit reaches PAID and cancellation reaches CANCELLED.
- Backup is verified and an off-host copy exists.
- Restore drill has passed on a disposable/non-production environment.
- Monitoring timer is active.
- Baseline load thresholds pass.
- Full field acceptance test has passed.

If one of these is false, keep the service in controlled test mode rather than opening public pilot traffic.
