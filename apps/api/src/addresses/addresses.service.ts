import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAddressDto) {
    const address = await this.prisma.$transaction(async (tx) => {
      const created = await tx.address.create({
        data: {
          userId,
          title: dto.title,
          formattedAddress: dto.formattedAddress,
          latitude: dto.latitude,
          longitude: dto.longitude,
          details: dto.details,
        },
      });

      await tx.$executeRaw`
        UPDATE "addresses"
        SET "location" = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
        WHERE "id" = CAST(${created.id} AS uuid)
      `;

      return created;
    });

    return this.serialize(address);
  }

  async list(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return addresses.map((address) => this.serialize(address));
  }

  async get(userId: string, id: string) {
    const address = await this.findOwned(userId, id);
    return this.serialize(address);
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.findOwned(userId, id);
    const latitude = dto.latitude ?? Number(existing.latitude);
    const longitude = dto.longitude ?? Number(existing.longitude);

    const address = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.address.update({
        where: { id },
        data: {
          title: dto.title,
          formattedAddress: dto.formattedAddress,
          latitude,
          longitude,
          details: dto.details,
        },
      });

      if (dto.latitude !== undefined || dto.longitude !== undefined) {
        await tx.$executeRaw`
          UPDATE "addresses"
          SET "location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
          WHERE "id" = CAST(${id} AS uuid)
        `;
      }

      return updated;
    });

    return this.serialize(address);
  }

  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { status: 'deleted' };
  }

  private async findOwned(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    return address;
  }

  private serialize<T extends { latitude: unknown; longitude: unknown }>(address: T) {
    return {
      ...address,
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };
  }
}
