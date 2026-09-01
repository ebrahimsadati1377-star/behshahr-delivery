# MVP Roadmap

## Phase 0 — Project Setup

Goal: make the repository safe and predictable for parallel development.

- [x] monorepo workspace
- [x] architecture document
- [x] Codex instructions (`AGENTS.md`)
- [x] data model contract
- [x] Turbo task graph
- [x] local Docker stack
- [x] CI for lint/typecheck/test/build

## Phase 1 — API Foundation

- [x] NestJS application
- [x] configuration validation at startup
- [x] PostgreSQL/PostGIS connection foundation
- [x] Prisma schema and first migration
- [x] Redis connection
- [x] health endpoint with DB + Redis checks
- [x] structured JSON logging with request IDs
- [x] global request validation
- [x] standardized error envelope

## Phase 2 — Authentication & Roles

- [x] customer/courier/admin roles
- [x] phone OTP request/verify flow
- [x] access + rotating refresh tokens
- [x] OTP request/attempt rate limits
- [x] authorization guards and role metadata
- [x] development SMS provider adapter
- [x] production SMS provider implementation (IPPanel pattern OTP)

## Phase 3 — Customer Order Flow

- [x] address CRUD
- [x] quote endpoint
- [x] configurable service-area validation
- [x] server-side locked quote with expiry and single-use consumption
- [x] production Neshan routing provider with safe fallback mode
- [x] order request endpoint from quoteId
- [x] order history/details with event timeline
- [x] customer cancellation before courier assignment
- [x] mobile-first RTL PWA shell
- [x] secure OTP login via Next.js BFF + HttpOnly cookies
- [x] installable manifest/service worker foundation
- [x] customer address create/edit/delete screens with device geolocation helper
- [x] quote + order creation screens
- [x] order history/detail/cancel screens
- [x] authenticated customer BFF proxy with transparent session refresh
- [x] fallback order status polling for degraded realtime conditions

## Phase 4 — Courier Flow

- [x] courier profile and vehicle
- [x] online/offline availability
- [x] assignment queue filtered by vehicle type
- [x] concurrency-safe accept/reject
- [x] pickup and delivery state transitions
- [x] location heartbeat with PostGIS point
- [x] courier/order audit events
- [x] courier PWA

## Phase 5 — Admin Operations

- [x] order board API
- [x] courier availability/location API
- [x] manual assignment and reassignment
- [x] order event timeline
- [x] admin web dashboard
- [x] pricing-rule management
- [x] service-zone management with PostGIS enforcement

## Phase 6 — Realtime & Notifications

- [x] realtime order updates via SSE
- [x] realtime customer tracking screen
- [x] courier location heartbeat exposed to tracking
- [ ] critical operational SMS/push notifications beyond OTP

## Phase 7 — Payment

- [x] payment domain linked one-to-one with orders
- [x] audited payment state transitions
- [x] cash-on-delivery pilot payment flow
- [x] admin cash-receipt confirmation
- [ ] online payment gateway initiation/verification (not required for controlled pilot)

## Phase 8 — Pilot Hardening

Repository-side launch package:

- [x] security review and explicit pilot go/no-go controls
- [x] reproducible dependency lockfile and frozen production builds
- [x] load-test tooling with p95/error-rate gates
- [x] verified backup/restore tooling and CI restore-drill definition
- [x] production Docker/Compose/Caddy deployment package
- [x] health monitoring and alert-webhook foundation
- [x] automated daily backup and minute-level health timers
- [x] admin/operations runbook and rollback procedure
- [x] Behshahr pilot launch checklist
- [x] safe initial ADMIN/COURIER provisioning tooling

Live go-live gates that require external production infrastructure or field access:

- [ ] deploy the release to the actual production host and DNS
- [ ] configure real IPPanel and Neshan credentials on the production host
- [ ] verify public TLS and production health monitoring
- [ ] copy a verified production backup off-host and complete a non-production restore drill
- [ ] run the load baseline against the actual production host
- [ ] complete the real-phone / real-courier field acceptance test
- [ ] open the controlled Behshahr pilot

## Post-MVP

Not required before first controlled launch:
- automatic multi-order batching
- route optimization across multiple stops
- courier wallet/payout automation
- referral system
- business/merchant accounts
- scheduled deliveries
- dynamic surge engine
- native Android/iOS apps

The first launch should optimize for operational reliability and fast iteration, not feature count.
