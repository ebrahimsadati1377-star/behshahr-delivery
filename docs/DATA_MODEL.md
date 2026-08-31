# Data Model

## Principles

- PostgreSQL is the source of truth.
- PostGIS is used for geo points, zones, and distance queries.
- Order address and pricing data are snapshotted so later edits do not rewrite history.
- Every meaningful order transition creates an immutable audit event.
- Monetary amounts are stored as integer toman values; never floating point.

## Tables

### users
- id: uuid PK
- phone: varchar unique
- role: enum CUSTOMER | COURIER | ADMIN
- status: enum ACTIVE | BLOCKED
- created_at
- updated_at

### couriers
- id: uuid PK
- user_id: uuid FK users unique
- vehicle_type: enum MOTORBIKE | CAR
- status: enum OFFLINE | AVAILABLE | BUSY | SUSPENDED
- current_location: geography(Point,4326) nullable
- last_seen_at nullable
- created_at
- updated_at

### addresses
- id: uuid PK
- user_id: uuid FK users
- title
- formatted_address
- latitude: decimal
- longitude: decimal
- details nullable
- created_at
- updated_at

### orders
- id: uuid PK
- public_code: varchar unique
- customer_id: uuid FK users
- courier_id: uuid FK couriers nullable
- status: enum DRAFT | QUOTED | REQUESTED | ASSIGNED | PICKED_UP | DELIVERED | CANCELLED | FAILED
- pickup_address_json: jsonb
- dropoff_address_json: jsonb
- pickup_point: geography(Point,4326)
- dropoff_point: geography(Point,4326)
- distance_meters: integer
- estimated_duration_seconds: integer nullable
- quoted_price_toman: integer
- final_price_toman: integer nullable
- notes: text nullable
- created_at
- assigned_at nullable
- picked_up_at nullable
- delivered_at nullable
- cancelled_at nullable

Indexes:
- customer_id + created_at desc
- courier_id + status
- status + created_at
- GiST on pickup_point
- GiST on dropoff_point

### order_events
- id: uuid PK
- order_id: uuid FK orders
- actor_type: enum SYSTEM | CUSTOMER | COURIER | ADMIN
- actor_id: uuid nullable
- event_type: varchar
- from_status nullable
- to_status nullable
- metadata: jsonb
- created_at

Index:
- order_id + created_at

### pricing_rules
- id: uuid PK
- vehicle_type: enum MOTORBIKE | CAR
- base_fare_toman: integer
- included_distance_meters: integer
- per_km_fare_toman: integer
- minimum_fare_toman: integer
- surge_multiplier: decimal default 1.0
- active_from_time nullable
- active_to_time nullable
- is_active: boolean
- created_at
- updated_at

### service_zones
- id: uuid PK
- name
- polygon: geography(Polygon,4326)
- is_active: boolean
- created_at
- updated_at

## Order invariants

- `final_price_toman` cannot be negative.
- courier assignment is only valid for an AVAILABLE courier unless an audited admin override is used.
- only ASSIGNED orders can move to PICKED_UP.
- only PICKED_UP orders can move to DELIVERED.
- terminal orders cannot transition again except through an explicit audited admin recovery action added later.
- all state changes happen inside a database transaction with the corresponding order event.

## MVP pricing formula

```text
billableMeters = max(0, distanceMeters - includedDistanceMeters)
variableFare = ceil(billableMeters / 1000) * perKmFareToman
rawFare = baseFareToman + variableFare
price = max(minimumFareToman, rawFare)
price = round(price * surgeMultiplier)
```

Routing distance may initially come from the map provider. Straight-line PostGIS distance is only a fallback and dispatch ranking signal, not the final customer price when route distance is available.
