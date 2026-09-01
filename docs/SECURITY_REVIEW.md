# Pilot Security Review

Scope: controlled Behshahr pilot of Customer PWA, Courier PWA, Admin Web, NestJS API, PostgreSQL/PostGIS, Redis, IPPanel OTP, and Neshan routing/maps.

This is an engineering security review for launch readiness, not a third-party penetration test.

## Security posture implemented

### Authentication and sessions
- Phone OTP with a 60-second cooldown and hourly/verification attempt limits.
- OTP values are HMAC-digested before storage in Redis; raw OTPs are not persisted.
- Production OTP delivery uses IPPanel; console OTP is rejected during production startup.
- Short-lived access tokens and rotating refresh tokens.
- Refresh sessions are revocable and logout is idempotent.
- Customer/Courier/Admin browser sessions use HttpOnly cookies through Next.js BFF routes; tokens are not stored in localStorage.
- Role guards protect Courier and Admin API operations.

### API and application
- Startup configuration validation fails closed on missing production secrets/providers.
- Global DTO validation whitelists fields and rejects unknown fields.
- Standardized error responses include request IDs without exposing stack traces.
- Structured request logs exclude request bodies, OTP values, authorization headers, and refresh tokens.
- Order assignment/accept/reassignment uses conditional updates and transactions to prevent double claims.
- Quote price/distance data is server locked, expires, and is single-use.
- Payment, order, and operational transitions have immutable audit events.

### Infrastructure
- Only Caddy publishes host ports (80/443). API, PostgreSQL, and Redis are not published to the host.
- Caddy obtains HTTPS certificates and sends HSTS, no-sniff, frame-deny, referrer, and permissions-policy headers.
- Admin and Courier surfaces are marked noindex.
- Application containers run as an unprivileged `app` user.
- PostgreSQL data, Redis AOF data, and Caddy certificate state use named Docker volumes.
- Deployment secrets are stored only in `ops/production.env` on the server; that path is gitignored.
- Real IPPanel/Neshan/JWT/database credentials must never be committed to this public repository.

## Pilot-specific risk decisions

### Cash payment for launch
The controlled pilot uses cash-on-delivery. Online payment is deliberately rejected before quote consumption until a gateway is configured. This removes payment-gateway credential/callback risk from the first launch while keeping an audited Payment domain ready for later integration.

### Realtime transport
Customer order updates use SSE plus a periodic safety refresh. Courier location is a foreground PWA heartbeat. Continuous native/background GPS collection is not part of this pilot.

### Service area
Active PostGIS service zones are the source of truth once a zone exists. The legacy environment radius is only a bootstrap fallback before the first database zone is created.

## Required launch controls

- [ ] Use a fresh production server with current security updates.
- [ ] Disable password SSH login; use SSH keys and a non-root sudo account where practical.
- [ ] Firewall: allow SSH from trusted addresses where possible; expose only TCP 80/443 and UDP 443 publicly.
- [ ] Do not publish Docker ports 4000, 5432, 6379, 3000, 3001, or 3002.
- [ ] Generate unique random POSTGRES/JWT/OTP secrets; do not reuse secrets from other systems.
- [ ] Restrict `ops/production.env` to the deployment account (`chmod 600`).
- [ ] Configure distinct Customer, Courier, and Admin DNS names.
- [ ] Confirm IPPanel Pattern is approved and sends only the intended OTP text.
- [ ] Restrict the Neshan Web Map key by allowed domains in the provider panel if supported.
- [ ] Provision the minimum number of Admin accounts required for the pilot.
- [ ] Take and verify a database backup before every production deploy after initial launch.
- [ ] Schedule daily backups and periodically perform a restore drill.
- [ ] Monitor public HTTPS plus internal `/api/health` and container restart state.
- [ ] Review application logs for repeated OTP failures, unusual admin actions, and sustained 5xx responses.

## Residual risks accepted for controlled pilot

- No independent penetration test has been completed yet.
- No Web Application Firewall is required for the controlled pilot; rate limiting currently focuses on OTP abuse rather than every route.
- Admin access is internet-reachable behind authentication unless an infrastructure-level VPN/IP allowlist is added.
- PWA courier tracking cannot guarantee background GPS delivery when the browser/app is suspended by the operating system.
- Online payments are intentionally unavailable.
- Push notifications are not required for the first controlled cohort; operational communication can use the dispatcher and SMS/phone fallback.

## Go / no-go security gates

Do not open the pilot to users if any of these are true:
- production starts with console SMS or placeholder secrets;
- PostgreSQL/Redis/API ports are publicly reachable;
- HTTPS is not valid on all three domains;
- Admin role provisioning is uncontrolled or shared credentials are used;
- the latest CI on `main` is not green;
- a tested database backup does not exist after real pilot data begins accumulating.
