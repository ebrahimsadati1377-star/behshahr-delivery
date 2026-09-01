# Behshahr Pilot Launch Checklist

This checklist separates repository-complete work from actions that require the real production server, DNS, credentials, and field staff.

## Repository / CI gates

- [ ] `main` contains the pilot-hardening PR.
- [ ] General CI is green on the release commit.
- [ ] Customer PWA CI is green.
- [ ] Courier PWA CI is green.
- [ ] Admin Web CI is green.
- [ ] Pilot Payment CI is green.
- [ ] Production Readiness CI is green.
- [ ] Pilot Hardening CI is green.
- [ ] Production Docker images build using the frozen lockfile.
- [ ] Production Compose config passes preflight.
- [ ] Caddy configuration validates.
- [ ] PostGIS migration completes from an empty database.
- [ ] API + all three web applications pass container health.
- [ ] Provision-user script creates ADMIN and COURIER correctly.
- [ ] Backup archive and checksum validate.
- [ ] Destructive restore drill restores a known probe record.
- [ ] Restored database boots the release successfully.
- [ ] Baseline health load test passes thresholds.
- [ ] Production dependency audit has no high/critical advisory gate failures.

## Production host gates

- [ ] Ubuntu 24.04 host provisioned and patched.
- [ ] Docker Engine and Compose v2 installed.
- [ ] Repository checked out at the intended release commit.
- [ ] Disk space, memory, and NTP verified.
- [ ] Firewall exposes only required public services; DB/Redis remain private.
- [ ] SSH administration is restricted appropriately.

## DNS / TLS gates

- [ ] Customer domain resolves to production host.
- [ ] Courier domain resolves to production host.
- [ ] Admin domain resolves to production host.
- [ ] Ports 80 and 443 are reachable.
- [ ] Caddy obtains valid TLS certificates for all three domains.

## Secret / provider gates

- [ ] `ops/production.env` exists only on the server and is mode 600.
- [ ] PostgreSQL password is unique and strong.
- [ ] OTP/JWT secrets are independently generated and at least 32 characters.
- [ ] Real IPPanel API key configured.
- [ ] Real IPPanel sender configured.
- [ ] Real IPPanel OTP pattern configured and tested on a real phone.
- [ ] Real Neshan Service API key configured.
- [ ] Real Neshan Web Map key configured.
- [ ] Neshan route distance/ETA is plausible for known Behshahr routes.
- [ ] No production secret is committed to GitHub.

## Business configuration gates

- [ ] Initial ADMIN provisioned.
- [ ] Pilot courier accounts provisioned with correct vehicle type.
- [ ] MOTORBIKE pricing rule reviewed and activated.
- [ ] CAR pricing reviewed/activated only if the pilot offers car delivery.
- [ ] Behshahr service zone reviewed and activated.
- [ ] Cash-on-delivery process explained to dispatcher/couriers.

## Operations / recovery gates

- [ ] Daily backup timer enabled.
- [ ] Minute-level health timer enabled.
- [ ] First manual production backup verified.
- [ ] At least one backup copied off-host.
- [ ] Restore drill completed on a disposable/non-production target.
- [ ] Alert webhook configured if one is being used for pilot monitoring.
- [ ] Dispatcher has the incident/rollback runbook.
- [ ] Previous known-good release commit is recorded before launch.

## Field acceptance gates

- [ ] Customer real OTP sign-in passes.
- [ ] Customer address/GPS flow passes.
- [ ] Quote with real route passes.
- [ ] Customer creates cash order.
- [ ] Admin sees and assigns order.
- [ ] Courier sees/accepts mission.
- [ ] Courier GPS appears to customer.
- [ ] Pickup transition passes.
- [ ] Delivery transition passes.
- [ ] Admin marks cash payment PAID.
- [ ] Customer sees DELIVERED + PAID.
- [ ] Customer cancellation before assignment produces CANCELLED payment.
- [ ] Admin reassignment between compatible couriers passes.
- [ ] Temporary mobile-network interruption recovers without manual DB intervention.

## Launch decision

The controlled pilot may open only when every applicable gate above is checked. Online payment, automated batching, courier wallet/payout, scheduled delivery, merchant accounts, and native apps are not pilot launch blockers.
