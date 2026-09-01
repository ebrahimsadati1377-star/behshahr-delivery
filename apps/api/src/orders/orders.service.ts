import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { concat, defer, from, interval, map, merge, of, switchMap } from 'rxjs';
import { PrismaService } from '../database/prisma.service';
import { QuotesService } from '../quotes/quotes.service';
import { OrderRealtimeService } from '../realtime/order-realtime.service';
import { CreateOrderDto } from './dto/create-order.dto';

type SerializedPaymentSource = {
  id: string;
  method: string;
  status: string;
  amount: bigint;
  provider: string | null;
  providerReference: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: QuotesService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  async create(userId: string, dto: CreateOrderDto) {
    const paymentMethod = dto.paymentMethod ?? 'CASH';
    if (paymentMethod === 'ONLINE') {
      throw new ServiceUnavailableException(
        'Online payment is not enabled for the pilot yet',
      );
    }

    const quote = await this.quotes.consumeLockedQuote(userId, dto.quoteId);

    try {
      const order = await this.prisma.order.create({
        data: {
          publicCode: this.publicCode(),
          customerId: userId,
          pricingRuleId: quote.pricingRuleId,
          vehicleType: quote.vehicleType,
          pickupSnapshot: { ...quote.pickupSnapshot },
          dropoffSnapshot: { ...quote.dropoffSnapshot },
          distanceMeters: quote.distanceMeters,
          estimatedDurationSeconds: quote.estimatedDurationSeconds,
          quotedPrice: BigInt(quote.priceToman),
          status: 'REQUESTED',
          notes: dto.notes,
          payment: {
            create: {
              method: paymentMethod,
              status: 'PENDING',
              amount: BigInt(quote.priceToman),
              provider: 'cash',
              events: {
                create: {
                  actorType: 'CUSTOMER',
                  actorId: userId,
                  eventType: 'PAYMENT_CREATED',
                  toStatus: 'PENDING',
                  metadata: { method: paymentMethod },
                },
              },
            },
          },
          events: {
            create: {
              actorType: 'CUSTOMER',
              actorId: userId,
              eventType: 'ORDER_REQUESTED',
              toStatus: 'REQUESTED',
              metadata: {
                quoteId: quote.quoteId,
                pricingRuleId: quote.pricingRuleId,
                vehicleType: quote.vehicleType,
                routingMode: quote.routingMode,
                paymentMethod,
              },
            },
          },
        },
        include: { payment: true },
      });

      return this.serializeOrder(order);
    } catch (error) {
      await this.quotes.restoreLockedQuote(quote);
      throw error;
    }
  }

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { customerId: userId },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async get(userId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, customerId: userId },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
        },
        payment: {
          include: {
            events: { orderBy: { createdAt: 'asc' } },
          },
        },
        courier: {
          select: {
            vehicleType: true,
            status: true,
            lastLatitude: true,
            lastLongitude: true,
            lastSeenAt: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const canTrackCourier = Boolean(
      order.courier &&
        (order.status === 'ASSIGNED' || order.status === 'PICKED_UP') &&
        order.courier.lastLatitude !== null &&
        order.courier.lastLongitude !== null,
    );

    return {
      ...this.serializeOrder(order),
      courierTracking: canTrackCourier
        ? {
            vehicleType: order.courier!.vehicleType,
            status: order.courier!.status,
            latitude: Number(order.courier!.lastLatitude),
            longitude: Number(order.courier!.lastLongitude),
            lastSeenAt: order.courier!.lastSeenAt,
          }
        : null,
      events: order.events.map((event) => ({
        id: event.id.toString(),
        actorType: event.actorType,
        actorId: event.actorId,
        eventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
      payment: order.payment
        ? {
            ...this.serializePayment(order.payment),
            events: order.payment.events.map((event) => ({
              id: event.id.toString(),
              actorType: event.actorType,
              actorId: event.actorId,
              eventType: event.eventType,
              fromStatus: event.fromStatus,
              toStatus: event.toStatus,
              metadata: event.metadata,
              createdAt: event.createdAt,
            })),
          }
        : null,
    };
  }

  stream(userId: string, id: string) {
    const snapshot = () =>
      defer(() => from(this.get(userId, id))).pipe(
        map((data) => ({ type: 'order', data })),
      );

    return snapshot().pipe(
      switchMap((initial) =>
        concat(
          of(initial),
          merge(
            this.realtime.subscribe(id).pipe(switchMap(() => snapshot())),
            interval(20_000).pipe(
              map(() => ({
                type: 'ping',
                data: { at: new Date().toISOString() },
              })),
            ),
          ),
        ),
      ),
    );
  }

  async cancel(userId: string, id: string) {
    const current = await this.prisma.order.findFirst({
      where: { id, customerId: userId },
    });

    if (!current) {
      throw new NotFoundException('Order not found');
    }

    if (current.status !== 'REQUESTED') {
      throw new ConflictException(
        'Customer cancellation is only allowed before courier assignment',
      );
    }

    const cancelled = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id,
          customerId: userId,
          status: 'REQUESTED',
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Order state changed; reload and try again');
      }

      await tx.orderEvent.create({
        data: {
          orderId: id,
          actorType: 'CUSTOMER',
          actorId: userId,
          eventType: 'ORDER_CANCELLED_BY_CUSTOMER',
          fromStatus: 'REQUESTED',
          toStatus: 'CANCELLED',
        },
      });

      const payment = await tx.payment.findUnique({ where: { orderId: id } });
      if (payment?.status === 'PENDING') {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'CANCELLED' },
        });
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            actorType: 'CUSTOMER',
            actorId: userId,
            eventType: 'PAYMENT_CANCELLED_WITH_ORDER',
            fromStatus: 'PENDING',
            toStatus: 'CANCELLED',
          },
        });
      }

      return tx.order.findUniqueOrThrow({
        where: { id },
        include: { payment: true },
      });
    });

    this.realtime.publish(id, 'ORDER_STATUS');
    return this.serializeOrder(cancelled);
  }

  private publicCode(): string {
    const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    return `BHD-${token}`;
  }

  private serializeOrder(order: {
    id: string;
    publicCode: string;
    customerId: string;
    courierId: string | null;
    pricingRuleId: string | null;
    vehicleType: string;
    pickupSnapshot: unknown;
    dropoffSnapshot: unknown;
    distanceMeters: number;
    estimatedDurationSeconds: number | null;
    quotedPrice: bigint;
    finalPrice: bigint | null;
    status: string;
    notes: string | null;
    createdAt: Date;
    assignedAt: Date | null;
    pickedUpAt: Date | null;
    deliveredAt: Date | null;
    cancelledAt: Date | null;
    updatedAt: Date;
    payment?: SerializedPaymentSource | null;
  }) {
    return {
      id: order.id,
      publicCode: order.publicCode,
      customerId: order.customerId,
      courierId: order.courierId,
      pricingRuleId: order.pricingRuleId,
      vehicleType: order.vehicleType,
      pickupSnapshot: order.pickupSnapshot,
      dropoffSnapshot: order.dropoffSnapshot,
      distanceMeters: order.distanceMeters,
      estimatedDurationSeconds: order.estimatedDurationSeconds,
      quotedPriceToman: Number(order.quotedPrice),
      finalPriceToman:
        order.finalPrice === null ? null : Number(order.finalPrice),
      currency: 'TOMAN',
      status: order.status,
      payment: order.payment ? this.serializePayment(order.payment) : null,
      notes: order.notes,
      createdAt: order.createdAt,
      assignedAt: order.assignedAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      updatedAt: order.updatedAt,
    };
  }

  private serializePayment(payment: SerializedPaymentSource) {
    return {
      id: payment.id,
      method: payment.method,
      status: payment.status,
      amountToman: Number(payment.amount),
      currency: 'TOMAN',
      provider: payment.provider,
      providerReference: payment.providerReference,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }
}
