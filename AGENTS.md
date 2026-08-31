# AGENTS.md

This repository is developed primarily with Codex-assisted workflows.

## Product
Behshahr Delivery is a local on-demand courier platform for Behshahr, Iran.

## Development principles
- Keep the MVP operationally simple and deployable.
- Prefer TypeScript end-to-end.
- Keep customer, courier and admin experiences mobile-first.
- Keep business logic in the API/domain layer, not duplicated in clients.
- Never commit secrets, API keys, tokens, passwords or production credentials.
- Add tests for pricing, order state transitions, dispatching and permissions.
- Use small focused commits and descriptive branch names.

## Initial architecture
- apps/customer: Next.js customer PWA
- apps/courier: Next.js courier PWA
- apps/admin: Next.js operations/admin panel
- apps/api: NestJS API
- packages/ui: shared UI components
- packages/types: shared contracts/types
- packages/config: shared TypeScript/lint configuration
- infra: Docker and deployment configuration
- docs: product and architecture documentation

## Order lifecycle
DRAFT -> QUOTED -> REQUESTED -> ASSIGNED -> PICKED_UP -> DELIVERED

Alternative terminal states:
- CANCELLED
- FAILED

Every state transition must be validated server-side and written to an order event log.

## MVP priorities
1. Authentication
2. Address + map selection
3. Delivery quote
4. Create order
5. Courier availability
6. Manual/semi-automatic dispatch
7. Live status updates
8. Admin operations panel
9. Payment integration
10. Production hardening
