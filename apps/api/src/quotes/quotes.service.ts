import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { RoutingProvider } from '../geo/routing.provider';
import { ServiceAreaService } from '../geo/service-area.service';
import { RedisService } from '../redis/redis.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { AddressSnapshot, LockedQuote } from './quote.types';

const QUOTE_TTL_SECONDS = 10 * 60;

type QuoteAddressIds = {
  pickupAddressId?: string;
  dropoffAddressId?: string;
};

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

    return this.createFromSnapshots(
      userId,
      this.addressSnapshot(pickup),
      this.addressSnapshot(dropoff),
      dto.vehicleType,
      { pickupAddressId: pickup.id, dropoffAddressId: dropoff.id },
    );
  }

  async createFromSnapshots(
    userId: string,
    pickupSnapshot: AddressSnapshot,
    dropoffSnapshot: AddressSnapshot,
    vehicleType: 'MOTORBIKE' | 'CAR',
    addressIds: QuoteAddressIds = {},
  ) {
    const pickupCoordinate = {
      latitude: pickupSnapshot.latitude,
      longitude: pickupSnapshot.longitude,
    };
    const dropoffCoordinate = {
      latitude: dropoffSnapshot.latitude,
      longitude: dropoffSnapshot.longitude,
    };

    await Promise.all([
      this.serviceArea.assertWithinServiceArea(pickupCoordinate, 'Pickup'),
      this.serviceArea.assertWithinServiceArea(dropoffCoordinate, 'Dropoff'),
    ]);

    const [route, pricingRule] = await Promise.all([
      this.routing.estimate(pickupCoordinate, dropoffCoordinate),
      this.findPricingRule(vehicleType),
    ]);

    const priceToman = this.calculatePrice(route.distanceMeters, pricingRule);
    const quoteId = randomUUID();
    const expiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000);
    const lockedQuote: LockedQuote = {
      quoteId,
      userId,
      ...addressIds,
      pickupSnapshot,
      dropoffSnapshot,
      vehicleType,
      distanceMeters: route.distanceMeters,
      estimatedDurationSeconds: route.durationSeconds,
      priceToman,
      pricingRuleId: pricingRule.id,
      routingMode: route.mode,
      expiresAt: expiresAt.toISOString(),
    };

    await this.redis.setEx(
      this.quoteKey(quoteId),
      QUOTE_TTL_SECONDS,
      JSON.stringify(lockedQuote),
    );

    return {
      quoteId,
      pickupAddressId: addressIds.pickupAddressId ?? null,
      dropoffAddressId: addressIds.dropoffAddressId ?? null,
      vehicleType,
      distanceMeters: route.distanceMeters,
      estimatedDurationSeconds: route.durationSeconds,
      priceToman,
      currency: 'TOMAN',
      pricingRuleId: pricingRule.id,
      routingMode: route.mode,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: QUOTE_TTL_SECONDS,
    };
  }

  async consumeLockedQuote(userId: string, quoteId: string): Promise<LockedQuote> {
    const key = this.quoteKey(quoteId);
    const visibleRaw = await this.redis.get(key);

    if (!visibleRaw) {
      throw new NotFoundException('Quote not found or expired');
    }

    const visibleQuote = this.parseLockedQuote(visibleRaw);

    if (visibleQuote.userId !== userId) {
      throw new NotFoundException('Quote not found or expired');
    }

    const consumedRaw = await this.redis.getAndDelete(key);

    if (!consumedRaw) {
      throw new NotFoundException('Quote was already used or expired');
    }

    const consumedQuote = this.parseLockedQuote(consumedRaw);

    if (
      consumedQuote.userId !== userId ||
      new Date(consumedQuote.expiresAt).getTime() <= Date.now()
    ) {
      throw new NotFoundException('Quote not found or expired');
    }

    return consumedQuote;
  }

  async restoreLockedQuote(quote: LockedQuote): Promise<void> {
    const ttlSeconds = Math.floor(
      (new Date(quote.expiresAt).getTime() - Date.now()) / 1000,
    );

    if (ttlSeconds > 0) {
      await this.redis.setIfAbsent(
        this.quoteKey(quote.quoteId),
        JSON.stringify(quote),
        ttlSeconds,
      );
    }
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

  private addressSnapshot(address: {
    title: string;
    formattedAddress: string;
    latitude: unknown;
    longitude: unknown;
    details: string | null;
  }): AddressSnapshot {
    return {
      title: address.title,
      formattedAddress: address.formattedAddress,
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
      details: address.details,
    };
  }

  private quoteKey(quoteId: string): string {
    return `quotes:${quoteId}`;
  }

  private parseLockedQuote(raw: string): LockedQuote {
    try {
      return JSON.parse(raw) as LockedQuote;
    } catch {
      throw new NotFoundException('Quote not found or expired');
    }
  }
}
