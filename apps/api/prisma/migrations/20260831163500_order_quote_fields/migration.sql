ALTER TABLE "orders" ADD COLUMN "pricing_rule_id" UUID;
ALTER TABLE "orders" ADD COLUMN "vehicle_type" "VehicleType";

UPDATE "orders"
SET "vehicle_type" = 'MOTORBIKE'
WHERE "vehicle_type" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "vehicle_type" SET NOT NULL;

CREATE INDEX "orders_pricing_rule_id_idx" ON "orders"("pricing_rule_id");

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_pricing_rule_id_fkey"
  FOREIGN KEY ("pricing_rule_id") REFERENCES "pricing_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
