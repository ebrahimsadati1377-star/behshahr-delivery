import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateCourierAvailabilityDto } from './dto/update-availability.dto';
import { UpdateCourierLocationDto } from './dto/update-location.dto';

@Injectable()
export class CouriersService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    return this.getCourierByUserId(userId);
  }

  async updateAvailability(userId: string, dto: UpdateCourierAvailabilityDto) {
    const courier = await this.getCourierByUserId(userId);

    if (courier.status === 'SUSPENDED') {
      throw new ForbiddenException('Courier is suspended');
    }

    if (courier.status === 'BUSY') {
      throw new ConflictException('Busy courier cannot change availability');
    }

    return this.prisma.courier.update({
      where: { id: courier.id },
      data: { status: dto.status },
    });
  }

  async updateLocation(userId: string, dto: UpdateCourierLocationDto) {
    const courier = await this.getCourierByUserId(userId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.courier.update({
        where: { id: courier.id },
        data: {
          lastLatitude: dto.latitude,
          lastLongitude: dto.longitude,
          lastSeenAt: now,
        },
      });

      await tx.$executeRaw`
        UPDATE "couriers"
        SET "last_location" = ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography
        WHERE "id" = ${courier.id}::uuid
      `;
    });

    return {
      courierId: courier.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      lastSeenAt: now,
    };
  }

  async availableOrders(userId: string) {
    const courier = await this.getCourierByUserId(userId);

    if (courier.status !== 'AVAILABLE') {
      throw new ConflictException('Courier must be AVAILABLE to view order queue');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        status: 'REQUESTED',
        courierId: null,
        vehicleType: courier.vehicleType,
      },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async currentOrder(userId: string) {
    const courier = await this.getCourierByUserId(userId);
    const order = await this.prisma.order.findFirst({
      where: {
        courierId: courier.id,
        status: { in: ['ASSIGNED', 'PICKED_UP'] },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return order ? this.serializeOrder(order) : null;
  }

  async acceptOrder(userId: string, orderId: string) {
    const courier = await this.getCourierByUserId(userId);

    if (courier.status !== 'AVAILABLE') {
      throw new ConflictException('Courier must be AVAILABLE to accept an order');
    }

    return this.prisma.$transaction(async (tx) => {
      const claimedCourier = await tx.courier.updateMany({
        where: {
          id: courier.id,
          status: 'AVAILABLE',
        },
        data: { status: 'BUSY' },
      });

      if (claimedCourier.count !== 1) {
        throw new ConflictException('Courier state changed; reload and try again');
      }

      const assignedAt = new Date();
      const claimedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'REQUESTED',
          courierId: null,
          vehicleType: courier.vehicleType,
        },
        data: {
          courierId: courier.id,
          status: 'ASSIGNED',
          assignedAt,
        },
      });

      if (claimedOrder.count !== 1) {
        throw new ConflictException('Order is no longer available');
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'COURIER',
          actorId: userId,
          eventType: 'ORDER_ACCEPTED_BY_COURIER',
          fromStatus: 'REQUESTED',
          toStatus: 'ASSIGNED',
          metadata: { courierId: courier.id },
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      return this.serializeOrder(order);
    });
  }

  async rejectAssignedOrder(userId: string, orderId: string) {
    const courier = await this.getCourierByUserId(userId);

    return this.prisma.$transaction(async (tx) => {
      const releasedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          courierId: courier.id,
          status: 'ASSIGNED',
        },
        data: {
          courierId: null,
          status: 'REQUESTED',
          assignedAt: null,
        },
      });

      if (releasedOrder.count !== 1) {
        throw new ConflictException('Only an assigned order can be rejected');
      }

      await tx.courier.updateMany({
        where: { id: courier.id, status: 'BUSY' },
        data: { status: 'AVAILABLE' },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'COURIER',
          actorId: userId,
          eventType: 'ORDER_REJECTED_BY_COURIER',
          fromStatus: 'ASSIGNED',
          toStatus: 'REQUESTED',
          metadata: { courierId: courier.id },
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      return this.serializeOrder(order);
    });
  }

  async markPickedUp(userId: string, orderId: string) {
    const courier = await this.getCourierByUserId(userId);
    const pickedUpAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          courierId: courier.id,
          status: 'ASSIGNED',
        },
        data: {
          status: 'PICKED_UP',
          pickedUpAt,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Order cannot be marked picked up');
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'COURIER',
          actorId: userId,
          eventType: 'ORDER_PICKED_UP',
          fromStatus: 'ASSIGNED',
          toStatus: 'PICKED_UP',
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      return this.serializeOrder(order);
    });
  }

  async markDelivered(userId: string, orderId: string) {
    const courier = await this.getCourierByUserId(userId);
    const deliveredAt = new Date();

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findFirst({
        where: {
          id: orderId,
          courierId: courier.id,
          status: 'PICKED_UP',
        },
      });

      if (!current) {
        throw new ConflictException('Order cannot be marked delivered');
      }

      const updated = await tx.order.updateMany({
        where: {
          id: orderId,
          courierId: courier.id,
          status: 'PICKED_UP',
        },
        data: {
          status: 'DELIVERED',
          deliveredAt,
          finalPrice: current.quotedPrice,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Order state changed; reload and try again');
      }

      await tx.courier.update({
        where: { id: courier.id },
        data: { status: 'AVAILABLE' },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'COURIER',
          actorId: userId,
          eventType: 'ORDER_DELIVERED',
          fromStatus: 'PICKED_UP',
          toStatus: 'DELIVERED',
        },
      });

      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      return this.serializeOrder(order);
    });
  }

  private async getCourierByUserId(userId: string) {
    const courier = await this.prisma.courier.findUnique({
      where: { userId },
    });

    if (!courier) {
      throw new NotFoundException('Courier profile not found');
    }

    return courier;
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
      finalPriceToman: order.finalPrice === null ? null : Number(order.finalPrice),
      currency: 'TOMAN',
      status: order.status,
      notes: order.notes,
      createdAt: order.createdAt,
      assignedAt: order.assignedAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      updatedAt: order.updatedAt,
    };
  }
}
