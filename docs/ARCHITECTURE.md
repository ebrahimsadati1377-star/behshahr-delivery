# Architecture

## Goals

The MVP should be cheap to operate, simple to deploy, and capable of growing from a small Behshahr launch into a larger last-mile platform without rewriting the core domain.

## System shape

```text
Customer PWA ----\
Courier PWA ------> API (NestJS) ---> PostgreSQL/PostGIS
Admin Panel -----/        |          Redis
                           |          Object storage (later)
                           +-------> WebSocket gateway
                           +-------> notification/SMS provider
                           +-------> map/routing provider
                           +-------> payment gateway
```

## Applications

### `apps/customer`
Mobile-first Next.js PWA.

Responsibilities:
- phone authentication
- pickup/drop-off selection
- quote request
- order creation
- order tracking
- order history

### `apps/courier`
Mobile-first Next.js PWA.

Responsibilities:
- courier authentication
- online/offline availability
- assigned jobs
- accept/reject flow
- pickup/drop-off navigation links
- order state updates
- location heartbeat

### `apps/admin`
Desktop/mobile responsive Next.js operations panel.

Responsibilities:
- live order board
- courier availability map/list
- manual assignment/reassignment
- pricing configuration
- service zones
- users/couriers
- incident/order event history

### `apps/api`
NestJS application containing domain and integration logic.

Initial modules:
- auth
- users
- couriers
- addresses
- pricing
- orders
- dispatch
- tracking
- notifications
- admin

## Core entities

### User
- id
- phone
- role: CUSTOMER | COURIER | ADMIN
- status
- createdAt

### Courier
- id
- userId
- vehicleType: MOTORBIKE | CAR
- status: OFFLINE | AVAILABLE | BUSY | SUSPENDED
- lastLocation
- lastSeenAt

### Address
- id
- userId
- title
- formattedAddress
- latitude
- longitude
- details

### Order
- id
- publicCode
- customerId
- courierId nullable
- pickupAddress snapshot
- dropoffAddress snapshot
- distanceMeters
- estimatedDurationSeconds
- quotedPrice
- finalPrice
- status
- notes
- createdAt / assignedAt / pickedUpAt / deliveredAt / cancelledAt

### OrderEvent
Immutable audit log for every important order transition.

- id
- orderId
- actorType
- actorId
- eventType
- fromStatus
- toStatus
- metadata JSON
- createdAt

### PricingRule
- baseFare
- includedDistanceMeters
- perKmFare
- minimumFare
- vehicleType
- active hours / optional surge multiplier

## Order state machine

Primary path:

```text
DRAFT
  -> QUOTED
  -> REQUESTED
  -> ASSIGNED
  -> PICKED_UP
  -> DELIVERED
```

Terminal alternatives:

```text
CANCELLED
FAILED
```

Rules:
- transitions are validated only by the API
- every accepted transition creates an OrderEvent
- customer cannot mark pickup/delivery states
- courier can only mutate orders assigned to that courier
- admin overrides must be audited

## Dispatch strategy: MVP

Start with operator-assisted dispatch rather than complex optimization.

1. Order enters `REQUESTED`.
2. API finds available couriers in the service area.
3. Admin sees ranked candidates by straight-line/route distance.
4. Admin assigns a courier or the system offers the closest courier.
5. Courier accepts; order becomes `ASSIGNED`.

Automated batching and multi-stop routing are explicitly post-MVP.

## Location and maps

Use PostGIS geography points for service zones and distance queries.

Courier location heartbeat should be throttled. The MVP does not need second-by-second GPS updates; 10–20 second active-job updates are sufficient initially.

Map/routing provider must be behind an adapter so the provider can be changed without rewriting domain logic.

## Security

- phone OTP authentication
- short-lived access token + refresh token rotation
- role-based authorization
- rate limiting for OTP and public quote endpoints
- server-side order state validation
- no secrets in frontend bundles or repository
- audit log for admin overrides

## Deployment

Initial deployment can run as Docker services on one VPS:
- reverse proxy
- API
- web apps
- PostgreSQL/PostGIS
- Redis

Split services only when traffic/operations justify it.
