CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'COURIER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "VehicleType" AS ENUM ('MOTORBIKE', 'CAR');
CREATE TYPE "CourierStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'BUSY', 'SUSPENDED');
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'QUOTED', 'REQUESTED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED', 'FAILED');
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'CUSTOMER', 'COURIER', 'ADMIN');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "phone" VARCHAR(20) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "couriers" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "vehicle_type" "VehicleType" NOT NULL,
  "status" "CourierStatus" NOT NULL DEFAULT 'OFFLINE',
  "last_latitude" DECIMAL(9,6),
  "last_longitude" DECIMAL(9,6),
  "last_location" geography(Point, 4326),
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "addresses" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "formatted_address" TEXT NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "location" geography(Point, 4326),
  "details" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "public_code" VARCHAR(20) NOT NULL,
  "customer_id" UUID NOT NULL,
  "courier_id" UUID,
  "pickup_snapshot" JSONB NOT NULL,
  "dropoff_snapshot" JSONB NOT NULL,
  "distance_meters" INTEGER NOT NULL,
  "estimated_duration_seconds" INTEGER,
  "quoted_price" BIGINT NOT NULL,
  "final_price" BIGINT,
  "status" "OrderStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_at" TIMESTAMP(3),
  "picked_up_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_events" (
  "id" BIGSERIAL NOT NULL,
  "order_id" UUID NOT NULL,
  "actor_type" "ActorType" NOT NULL,
  "actor_id" UUID,
  "event_type" VARCHAR(80) NOT NULL,
  "from_status" "OrderStatus",
  "to_status" "OrderStatus",
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pricing_rules" (
  "id" UUID NOT NULL,
  "vehicle_type" "VehicleType" NOT NULL,
  "base_fare" BIGINT NOT NULL,
  "included_distance_meters" INTEGER NOT NULL,
  "per_km_fare" BIGINT NOT NULL,
  "minimum_fare" BIGINT NOT NULL,
  "surge_multiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "couriers_user_id_key" ON "couriers"("user_id");
CREATE UNIQUE INDEX "orders_public_code_key" ON "orders"("public_code");

CREATE INDEX "couriers_status_idx" ON "couriers"("status");
CREATE INDEX "couriers_last_location_gix" ON "couriers" USING GIST ("last_location");
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");
CREATE INDEX "addresses_location_gix" ON "addresses" USING GIST ("location");
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");
CREATE INDEX "orders_courier_id_status_idx" ON "orders"("courier_id", "status");
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");
CREATE INDEX "pricing_rules_vehicle_type_is_active_idx" ON "pricing_rules"("vehicle_type", "is_active");

ALTER TABLE "couriers"
  ADD CONSTRAINT "couriers_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "addresses"
  ADD CONSTRAINT "addresses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_events"
  ADD CONSTRAINT "order_events_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
