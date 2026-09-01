CREATE TABLE "service_zones" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "center_latitude" DECIMAL(9,6) NOT NULL,
  "center_longitude" DECIMAL(9,6) NOT NULL,
  "radius_meters" INTEGER NOT NULL,
  "polygon" geography(Polygon, 4326) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_zones_is_active_idx" ON "service_zones"("is_active");
CREATE INDEX "service_zones_polygon_gix" ON "service_zones" USING GIST ("polygon");
