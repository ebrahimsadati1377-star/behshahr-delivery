import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { RoutingProvider } from '../geo/routing.provider';
import { ServiceAreaService } from '../geo/service-area.service';
import { RedisService } from '../redis/redis.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

const QUOTE_TTL_SECONDS = 10 * 60;

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly routing: RoutingProvider,
    private readonly serviceArea: ServiceAreaService,
  ) {}

  async create(userId: string, dto: CreateQuoteDto) {
    const [pickup, dropoff] = await Promise.all([
      this.prisma.address.findFirst({
        where: { id: dto.pickupAddressId, userId },
      }),
      this.prisma.address.findFirst({
        where: { id: dto.dropoffAddressId, userId },
      }),
    ]);

    if (!pickup) {
      throw new NotFoundException('Pickup address not found');
    }

    if (!dropoff) {
      throw new NotFoundException('Dropoff address not found');
    }

    const pickupCoordinate = {
      latitude: Number(pickup.latitude),
      longitude: Number(pickup.longitude),
    };
    const dropoffCoordinate = {
      latitude: Number(dropoff.latitude),
      longitude: Number(dropoff.longitude),
    };

    this.serviceArea.assertWithinServiceArea(pickupCoordinate, 'Pickup');
    this.serviceArea.assertWithinServiceArea(dropoffCoordinate, 'Dropoff');

    const [route, pricingRule] = await Promise.all([
      this.routing.estimate(pickupCoordinate, dropoffCoordinate),
      this.findPricingRule(dto.vehicleType),
    ]);

    const priceToman = this.calculatePrice(route.distanceMeters, pricingRule);
    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);
    const lockedQuote = {
      quoteId,
      userId,
      pickupAddressId: pickup.id,
      dropoffAddressId: dropoff.id,
      vehicleType: dto.vehicleType,
      distanceMeters: route.distanceMeters,
      estimatedDurationSeconds: route.durationSeconds,
      priceToman,
      pricingRuleId: pricingRule.id,
      routingMode: route.mode,
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis.setEx(
      `quotes:${quoteId}`,
      QUOTE_TTL_SECONDS,
      JSON.stringify(lockedQuote),
    );

    return {
      ...lockedQuote,
      currency: 'TOMAN',
      expiresInSeconds: QUOTE_TTL_SECONDS,
    };
  }

  private async findPricingRule(vehicleType: 'MOTORBIKE' | 'CAR') {
    const now = new Date();
    const pricingRule = await this.prisma.pricingRule.findFirst({
      where: {
        vehicleType,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pricingRule) {
      throw new ServiceUnavailableException(
        `No active pricing rule for ${vehicleType}`,
      );
    }

    return pricingRule;
  }

  private calculatePrice(
    distanceMeters: number,
    rule: {
      baseFare: bigint;
      includedDistanceMeters: number;
      perKmFare: bigint;
      minimumFare: bigint;
      surgeMultiplier: unknown;
    },
  ): number {
    const baseFare = Number(rule.baseFare);
    const perKmFare = Number(rule.perKmFare);
    const minimumFare = Number(rule.minimumFare);
    const surgeMultiplier = Number(rule.surgeMultiplier);
    const billableMeters = Math.max(
      0,
      distanceMeters - rule.includedDistanceMeters,
    );
    const distanceFare = Math.ceil((billableMeters / 1000) * perKmFare);
    const subtotal = Math.max(minimumFare, baseFare + distanceFare);

    return Math.ceil(subtotal * surgeMultiplier);
  }
}
