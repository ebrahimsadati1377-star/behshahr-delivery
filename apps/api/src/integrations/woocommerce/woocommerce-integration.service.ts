import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { OrdersService } from '../../orders/orders.service';
import { AddressSnapshot } from '../../quotes/quote.types';
import { QuotesService } from '../../quotes/quotes.service';
import { OrderRealtimeService } from '../../realtime/order-realtime.service';
import { CreateWooCommerceOrderDto } from './dto/create-woocommerce-order.dto';
import { UpdateWooCommerceOrderStatusDto } from './dto/update-woocommerce-order-status.dto';

const PROVIDER = 'woocommerce';

@Injectable()
export class WooCommerceIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly orders: OrdersService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  async createOrder(apiKey: string | undefined, dto: CreateWooCommerceOrderDto) {
    this.assertApiKey(apiKey);

    const storeId = dto.storeId.trim();
    const externalOrderId = dto.externalOrderId.trim();
    if (!storeId || !externalOrderId) {
      throw new BadRequestException('Store ID and external order ID are required');
    }

    const existing = await this.orders.findIntegrationOrder(
      PROVIDER,
      storeId,
      externalOrderId,
    );
    if (existing) return existing;

    const storeUser = await this.ensureStoreCustomer(storeId);
    const pickup = this.addressSnapshot(dto.pickup);
    const dropoff = this.addressSnapshot(dto.dropoff);
    const quote = await this.quotes.createFromSnapshots(
      storeUser.id,
      pickup,
      dropoff,
      dto.vehicleType,
    );

    return this.orders.createFromIntegration(storeUser.id, {
      quoteId: quote.quoteId,
      provider: PROVIDER,
      storeId,
      externalOrderId,
      recipientName: dto.customer.name.trim(),
      recipientPhone: this.normalizeIranianPhone(dto.customer.phone),
      notes: this.orderNotes(dto),
      upstreamPaid: dto.payment?.paid ?? false,
      sourcePayload: JSON.parse(JSON.stringify(dto)) as Prisma.InputJsonValue,
    });
  }

  async updateOrderStatus(
    apiKey: string | undefined,
    dto: UpdateWooCommerceOrderStatusDto,
  ) {
    this.assertApiKey(apiKey);

    const storeId = dto.storeId.trim();
    const externalOrderId = dto.externalOrderId.trim();
    if (!storeId || !externalOrderId) {
      throw new BadRequestException('Store ID and external order ID are required');
    }

    const link = await this.prisma.externalOrderLink.findUnique({
      where: {
        provider_storeId_externalOrderId: {
          provider: PROVIDER,
          storeId,
          externalOrderId,
        },
      },
      include: { order: true },
    });

    if (!link) {
      throw new NotFoundException('WooCommerce order is not linked to Delivery');
    }

    if (link.order.status === 'DELIVERED') {
      const existing = await this.orders.findIntegrationOrder(
        PROVIDER,
        storeId,
        externalOrderId,
      );
      return { synced: false, alreadyCompleted: true, ...existing };
    }

    if (link.order.status === 'CANCELLED') {
      return { synced: false, alreadyCancelled: true, order: link.order };
    }

    if (link.order.status === 'ASSIGNED' || link.order.status === 'PICKED_UP') {
      return {
        synced: false,
        ignored: true,
        reason: 'Courier delivery is already in progress',
        order: link.order,
      };
    }

    const cancelledAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: link.order.id,
          status: 'REQUESTED',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Order state changed; retry status sync');
      }

      await tx.orderEvent.create({
        data: {
          orderId: link.order.id,
          actorType: 'SYSTEM',
          eventType: 'ORDER_CANCELLED_FROM_WOOCOMMERCE',
          fromStatus: link.order.status,
          toStatus: 'CANCELLED',
          metadata: {
            provider: PROVIDER,
            storeId,
            externalOrderId,
            upstreamStatus: dto.status,
          },
        },
      });
    });

    this.realtime.publish(link.order.id, 'ORDER_STATUS');
    const synced = await this.orders.findIntegrationOrder(
      PROVIDER,
      storeId,
      externalOrderId,
    );
    return { synced: true, alreadyCompleted: false, ...synced };
  }

  private async ensureStoreCustomer(storeId: string) {
    const hash = createHash('sha256').update(storeId).digest('hex').slice(0, 16);
    const phone = `woo:${hash}`;

    return this.prisma.user.upsert({
      where: { phone },
      create: { phone, role: 'CUSTOMER', status: 'ACTIVE' },
      update: { status: 'ACTIVE' },
    });
  }

  private addressSnapshot(address: {
    title: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    details?: string;
  }): AddressSnapshot {
    const title = address.title.trim();
    const formattedAddress = address.formattedAddress.trim();
    if (!title || !formattedAddress) {
      throw new BadRequestException('Pickup and dropoff addresses are required');
    }

    return {
      title,
      formattedAddress,
      latitude: address.latitude,
      longitude: address.longitude,
      details: address.details?.trim() || null,
    };
  }

  private orderNotes(dto: CreateWooCommerceOrderDto): string {
    const parts = [
      `WooCommerce #${dto.externalOrderId.trim()}`,
      `گیرنده: ${dto.customer.name.trim()}`,
      `تلفن: ${this.normalizeIranianPhone(dto.customer.phone)}`,
    ];
    if (dto.notes?.trim()) parts.push(`توضیحات: ${dto.notes.trim()}`);
    return parts.join('\n');
  }

  private normalizeIranianPhone(input: string): string {
    const value = input.trim().replace(/[\s-]/g, '');
    if (/^09\d{9}$/.test(value)) return `+98${value.slice(1)}`;
    if (/^989\d{9}$/.test(value)) return `+${value}`;
    if (/^\+989\d{9}$/.test(value)) return value;
    throw new BadRequestException('Invalid Iranian customer phone');
  }

  private assertApiKey(provided: string | undefined): void {
    const expected = process.env.WOOCOMMERCE_INTEGRATION_KEY?.trim();
    if (!expected) {
      throw new ServiceUnavailableException(
        'WooCommerce integration is not configured',
      );
    }
    if (!provided) throw new UnauthorizedException('Invalid integration key');

    const expectedHash = createHash('sha256').update(expected).digest();
    const providedHash = createHash('sha256').update(provided.trim()).digest();
    if (!timingSafeEqual(expectedHash, providedHash)) {
      throw new UnauthorizedException('Invalid integration key');
    }
  }
}
