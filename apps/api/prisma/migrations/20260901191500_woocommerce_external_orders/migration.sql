CREATE TABLE "external_order_links" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "store_id" VARCHAR(80) NOT NULL,
    "external_order_id" VARCHAR(120) NOT NULL,
    "order_id" UUID NOT NULL,
    "recipient_name" VARCHAR(160),
    "recipient_phone" VARCHAR(20),
    "source_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_order_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_order_links_order_id_key" ON "external_order_links"("order_id");
CREATE UNIQUE INDEX "external_order_links_provider_store_id_external_order_id_key" ON "external_order_links"("provider", "store_id", "external_order_id");
CREATE INDEX "external_order_links_store_id_created_at_idx" ON "external_order_links"("store_id", "created_at");

ALTER TABLE "external_order_links"
ADD CONSTRAINT "external_order_links_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
