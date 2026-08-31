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
- [ ] configuration validation at startup
- [x] PostgreSQL/PostGIS connection foundation
- [x] Prisma schema and first migration
- [x] Redis connection
- [x] health endpoint with DB + Redis checks
- [ ] structured logging
- [x] global request validation
- [ ] standardized error envelope

## Phase 2 — Authentication & Roles

- [x] customer/courier/admin roles
- [x] phone OTP request/verify flow
- [x] access + rotating refresh tokens
- [x] OTP request/attempt rate limits
- [x] authorization guards and role metadata
- [x] development SMS provider adapter
- [ ] production SMS provider implementation

## Phase 3 — Customer Order Flow

- [x] address CRUD
- [x] quote endpoint
- [x] configurable service-area validation
- [x] server-side locked quote with expiry
- [ ] production map/routing provider
- [ ] order request endpoint
- [ ] order history/details
- [ ] cancellation rules
- [ ] customer PWA screens for the complete flow

## Phase 4 — Courier Flow

- [ ] courier profile and vehicle
- [ ] online/offline availability
- [ ] assignment queue
- [ ] accept/reject
- [ ] pickup and delivery state transitions
- [ ] location heartbeat
- [ ] courier PWA

## Phase 5 — Admin Operations

- [ ] live order board
- [ ] courier availability list/map
- [ ] manual assignment and reassignment
- [ ] order event timeline
- [ ] pricing-rule management
- [ ] service-zone management

## Phase 6 — Realtime & Notifications

- [ ] WebSocket order updates
- [ ] customer tracking screen
- [ ] courier location updates
- [ ] SMS/push adapter and critical notifications

## Phase 7 — Payment

- [ ] payment adapter
- [ ] online payment initiation/verification
- [ ] payment state audit trail
- [ ] cash/manual payment option if business requires it

## Phase 8 — Pilot Hardening

- [ ] security review
- [ ] load test for expected pilot traffic
- [ ] backup/restore procedure
- [ ] production Docker deployment
- [ ] monitoring and alerting
- [ ] admin runbook
- [ ] Behshahr pilot launch checklist

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
