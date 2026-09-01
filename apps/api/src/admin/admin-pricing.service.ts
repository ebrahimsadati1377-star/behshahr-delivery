import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';

@Injectable()
export class AdminPricingService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rules = await this.prisma.pricingRule.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rules.map((rule) => this.serialize(rule));
  }

  async create(dto: CreatePricingRuleDto) {
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.pricingRule.updateMany({
        where: { vehicleType: dto.vehicleType, isActive: true },
        data: { isActive: false, endsAt: now },
      });

      const rule = await tx.pricingRule.create({
        data: {
          vehicleType: dto.vehicleType,
          baseFare: BigInt(dto.baseFare),
          includedDistanceMeters: dto.includedDistanceMeters,
          perKmFare: BigInt(dto.perKmFare),
          minimumFare: BigInt(dto.minimumFare),
          surgeMultiplier: dto.surgeMultiplier,
          startsAt: now,
          isActive: true,
        },
      });

      return this.serialize(rule);
    });
  }

  async deactivate(id: string) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule not found');

    const updated = await this.prisma.pricingRule.update({
      where: { id },
      data: {
        isActive: false,
        endsAt: rule.endsAt ?? new Date(),
      },
    });

    return this.serialize(updated);
  }

  private serialize(rule: {
    id: string;
    vehicleType: string;
    baseFare: bigint;
    includedDistanceMeters: number;
    perKmFare: bigint;
    minimumFare: bigint;
    surgeMultiplier: unknown;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: rule.id,
      vehicleType: rule.vehicleType,
      baseFareToman: Number(rule.baseFare),
      includedDistanceMeters: rule.includedDistanceMeters,
      perKmFareToman: Number(rule.perKmFare),
      minimumFareToman: Number(rule.minimumFare),
      surgeMultiplier: Number(rule.surgeMultiplier),
      startsAt: rule.startsAt,
      endsAt: rule.endsAt,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    };
  }
}
