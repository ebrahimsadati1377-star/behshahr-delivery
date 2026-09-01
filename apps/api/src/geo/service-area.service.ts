import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { Coordinate, haversineDistanceMeters } from './geo.utils';

@Injectable()
export class ServiceAreaService {
  constructor(private readonly prisma: PrismaService) {}

  async assertWithinServiceArea(point: Coordinate, label: string): Promise<void> {
    const [zoneState] = await this.prisma.$queryRaw<
      Array<{ totalCount: number; covered: boolean }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::int AS "totalCount",
        COALESCE(
          BOOL_OR(
            "is_active" AND ST_Covers(
              "polygon",
              ST_SetSRID(ST_MakePoint(${point.longitude}, ${point.latitude}), 4326)::geography
            )
          ),
          false
        ) AS "covered"
      FROM "service_zones"
    `);

    if ((zoneState?.totalCount ?? 0) === 0) {
      this.assertWithinLegacyRadius(point, label);
      return;
    }

    if (!zoneState?.covered) {
      throw new BadRequestException(`${label} is outside the service area`);
    }
  }

  private assertWithinLegacyRadius(point: Coordinate, label: string): void {
    const center = {
      latitude: this.requiredNumberEnv('SERVICE_CENTER_LAT'),
      longitude: this.requiredNumberEnv('SERVICE_CENTER_LNG'),
    };
    const radiusMeters = this.requiredNumberEnv('SERVICE_RADIUS_METERS');
    const distance = haversineDistanceMeters(center, point);

    if (distance > radiusMeters) {
      throw new BadRequestException(`${label} is outside the service area`);
    }
  }

  private requiredNumberEnv(name: string): number {
    const raw = process.env[name];
    const value = Number(raw);

    if (!raw || !Number.isFinite(value)) {
      throw new Error(`${name} is required and must be numeric`);
    }

    return value;
  }
}
