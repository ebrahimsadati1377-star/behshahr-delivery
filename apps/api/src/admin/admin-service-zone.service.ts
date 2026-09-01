import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';

@Injectable()
export class AdminServiceZoneService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const zones = await this.prisma.serviceZone.findMany({
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return zones.map((zone) => this.serialize(zone));
  }

  async create(dto: CreateServiceZoneDto) {
    const id = randomUUID();

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO "service_zones" (
        "id",
        "name",
        "center_latitude",
        "center_longitude",
        "radius_meters",
        "polygon",
        "is_active",
        "created_at",
        "updated_at"
      ) VALUES (
        ${id}::uuid,
        ${dto.name.trim()},
        ${dto.centerLatitude},
        ${dto.centerLongitude},
        ${dto.radiusMeters},
        ST_Buffer(
          ST_SetSRID(ST_MakePoint(${dto.centerLongitude}, ${dto.centerLatitude}), 4326)::geography,
          ${dto.radiusMeters}
        ),
        true,
        NOW(),
        NOW()
      )
    `);

    return this.find(id);
  }

  async activate(id: string) {
    await this.ensureExists(id);
    const zone = await this.prisma.serviceZone.update({
      where: { id },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return this.serialize(zone);
  }

  async deactivate(id: string) {
    await this.ensureExists(id);
    const zone = await this.prisma.serviceZone.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return this.serialize(zone);
  }

  private async find(id: string) {
    const zone = await this.prisma.serviceZone.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        centerLatitude: true,
        centerLongitude: true,
        radiusMeters: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!zone) throw new NotFoundException('Service zone not found');
    return this.serialize(zone);
  }

  private async ensureExists(id: string): Promise<void> {
    const zone = await this.prisma.serviceZone.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Service zone not found');
  }

  private serialize(zone: {
    id: string;
    name: string;
    centerLatitude: unknown;
    centerLongitude: unknown;
    radiusMeters: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: zone.id,
      name: zone.name,
      centerLatitude: Number(zone.centerLatitude),
      centerLongitude: Number(zone.centerLongitude),
      radiusMeters: zone.radiusMeters,
      isActive: zone.isActive,
      createdAt: zone.createdAt,
      updatedAt: zone.updatedAt,
    };
  }
}
