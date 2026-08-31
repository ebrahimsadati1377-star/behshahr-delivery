# MVP Roadmap

## Phase 0 — Project Setup

Goal: make the repository safe and predictable for parallel development.

- [x] monorepo workspace
- [x] architecture document
- [x] Codex instructions (`AGENTS.md`)
- [x] data model contract
- [x] Turbo task graph
- [ ] local Docker stack
- [ ] CI for lint/typecheck/test/build

## Phase 1 — API Foundation

- NestJS application
- configuration validation
- PostgreSQL/PostGIS connection
- Prisma schema and first migration
- Redis connection
- health endpoint
- structured logging
- global validation/error format

Definition of done:
- API starts locally with one command
- database migration runs cleanly
- health endpoint checks API + DB + Redis
- CI passes

## Phase 2 — Authentication & Roles

- customer/courier/admin roles
- phone OTP request/verify flow
- access + rotating refresh tokens
- OTP and auth rate limits
- authorization guards

For development, SMS must be behind a provider adapter with a local fake provider.

## Phase 3 — Customer Order Flow

- address CRUD
- quote endpoint
- service-zone validation
- order request endpoint
- order history/details
- cancellation rules
- customer PWA screens for the complete flow

## Phase 4 — Courier Flow

- courier profile and vehicle
- online/offline availability
- assignment queue
- accept/reject
- pickup and delivery state transitions
- location heartbeat
- courier PWA

## Phase 5 — Admin Operations

- live order board
- courier availability list/map
- manual assignment and reassignment
- order event timeline
- pricing-rule management
- service-zone management

## Phase 6 — Realtime & Notifications

- WebSocket order updates
- customer tracking screen
- courier location updates
- SMS/push adapter and critical notifications

## Phase 7 — Payment

- payment adapter
- online payment initiation/verification
- payment state audit trail
- cash/manual payment option if business requires it

## Phase 8 — Pilot Hardening

- security review
- load test for expected pilot traffic
- backup/restore procedure
- production Docker deployment
- monitoring and alerting
- admin runbook
- Behshahr pilot launch checklist

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
