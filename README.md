# Behshahr Delivery

Local on-demand last-mile delivery platform for Behshahr, Iran.

## MVP

The first release will provide three operational surfaces:

- **Customer PWA** — create a delivery request, select pickup/drop-off, receive a quote, track status.
- **Courier PWA** — go online/offline, accept assigned jobs, navigate, update pickup/delivery state.
- **Admin panel** — monitor orders/couriers, manually dispatch orders, manage pricing and service zones.

## Architecture

TypeScript monorepo:

```text
apps/
  customer/   Next.js customer PWA
  courier/    Next.js courier PWA
  admin/      Next.js operations panel
  api/        NestJS API
packages/
  ui/         shared UI components
  types/      shared TypeScript contracts
  config/     shared tooling/config
infra/        Docker and deployment files
docs/         architecture and product documentation
```

Core infrastructure:

- PostgreSQL + PostGIS
- Redis
- WebSockets for live status/tracking
- Docker for local development and deployment

## Order lifecycle

```text
DRAFT -> QUOTED -> REQUESTED -> ASSIGNED -> PICKED_UP -> DELIVERED
                               \-> CANCELLED
                               \-> FAILED
```

## Development workflow

- `main` stays deployable.
- Work is done on focused branches such as `codex/...` or `feature/...`.
- Codex should read `AGENTS.md` before making implementation changes.
- Never commit secrets or production credentials.

## Current phase

Phase 0: repository and MVP architecture bootstrap.

See:

- `docs/ARCHITECTURE.md`
- `docs/MVP-ROADMAP.md`
