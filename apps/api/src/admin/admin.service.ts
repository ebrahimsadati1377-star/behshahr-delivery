import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { AssignOrderDto } from './dto/assign-order.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async orders() {
    const orders = await this.prisma.order.findMany({
      include: {
        customer: { select: { id: true, phone: true } },
        courier: {
          include: { user: { select: { id: true, phone: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async order(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, phone: true } },
        courier: {
          include: { user: { select: { id: true, phone: true } } },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      ...this.serializeOrder(order),
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
    };
  }

  async couriers() {
    const couriers = await this.prisma.courier.findMany({
      include: { user: { select: { id: true, phone: true, status: true } } },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    return couriers.map((courier) => ({
      id: courier.id,
      userId: courier.userId,
      phone: courier.user.phone,
      userStatus: courier.user.status,
      vehicleType: courier.vehicleType,
      status: courier.status,
      lastLatitude: courier.lastLatitude === null ? null : Number(courier.lastLatitude),
      lastLongitude: courier.lastLongitude === null ? null : Number(courier.lastLongitude),
      lastSeenAt: courier.lastSeenAt,
      createdAt: courier.createdAt,
      updatedAt: courier.updatedAt,
    }));
  }

  async assignOrder(adminUserId: string, orderId: string, dto: AssignOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'REQUESTED' || order.courierId !== null) {
        throw new ConflictException('Only unassigned REQUESTED orders can be assigned');
      }

      const courier = await tx.courier.findUnique({ where: { id: dto.courierId } });
      if (!courier) throw new NotFoundException('Courier not found');
      if (courier.vehicleType !== order.vehicleType) {
        throw new ConflictException('Courier vehicle type does not match order');
      }

      const claimedCourier = await tx.courier.updateMany({
        where: { id: courier.id, status: 'AVAILABLE' },
        data: { status: 'BUSY' },
      });
      if (claimedCourier.count !== 1) {
        throw new ConflictException('Courier is not available');
      }

      const assignedAt = new Date();
      const assignedOrder = await tx.order.updateMany({
        where: { id: orderId, status: 'REQUESTED', courierId: null },
        data: { courierId: courier.id, status: 'ASSIGNED', assignedAt },
      });
      if (assignedOrder.count !== 1) {
        throw new ConflictException('Order state changed; reload and try again');
      }

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'ADMIN',
          actorId: adminUserId,
          eventType: 'ORDER_ASSIGNED_BY_ADMIN',
          fromStatus: 'REQUESTED',
          toStatus: 'ASSIGNED',
          metadata: { courierId: courier.id },
        },
      });

      return this.orderInTransaction(tx, orderId);
    });
  }

  async reassignOrder(adminUserId: string, orderId: string, dto: AssignOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'ASSIGNED' || !order.courierId) {
        throw new ConflictException('Only ASSIGNED orders can be reassigned');
      }
      if (order.courierId === dto.courierId) {
        throw new ConflictException('Order is already assigned to this courier');
      }

      const target = await tx.courier.findUnique({ where: { id: dto.courierId } });
      if (!target) throw new NotFoundException('Courier not found');
      if (target.vehicleType !== order.vehicleType) {
        throw new ConflictException('Courier vehicle type does not match order');
      }

      const claimedTarget = await tx.courier.updateMany({
        where: { id: target.id, status: 'AVAILABLE' },
        data: { status: 'BUSY' },
      });
      if (claimedTarget.count !== 1) {
        throw new ConflictException('Target courier is not available');
      }

      const previousCourierId = order.courierId;
      const movedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'ASSIGNED',
          courierId: previousCourierId,
        },
        data: { courierId: target.id, assignedAt: new Date() },
      });
      if (movedOrder.count !== 1) {
        throw new ConflictException('Order state changed; reload and try again');
      }

      await tx.courier.updateMany({
        where: { id: previousCourierId, status: 'BUSY' },
        data: { status: 'AVAILABLE' },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'ADMIN',
          actorId: adminUserId,
          eventType: 'ORDER_REASSIGNED_BY_ADMIN',
          fromStatus: 'ASSIGNED',
          toStatus: 'ASSIGNED',
          metadata: {
            previousCourierId,
            courierId: target.id,
          },
        },
      });

      return this.orderInTransaction(tx, orderId);
    });
  }

  private async orderInTransaction(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        customer: { select: { id: true, phone: true } },
        courier: { include: { user: { select: { id: true, phone: true } } } },
      },
    });
    return this.serializeOrder(order);
  }

  private serializeOrder(order: {
    id: string;
    publicCode: string;
    customerId: string;
    customer?: { id: string; phone: string } | null;
    courierId: string | null;
    courier?: {
      id: string;
      userId: string;
      vehicleType: string;
      status: string;
      user?: { phone: string } | null;
    } | null;
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
      customer: order.customer ?? null,
      courierId: order.courierId,
      courier: order.courier
        ? {
            id: order.courier.id,
            userId: order.courier.userId,
            phone: order.courier.user?.phone ?? null,
            vehicleType: order.courier.vehicleType,
            status: order.courier.status,
          }
        : null,
      vehicleType: order.vehicleType,
      pickupSnapshot: order.pickupSnapshot,
      dropoffSnapshot: order.dropoffSnapshot,
      distanceMeters: order.distanceMeters,
      estimatedDurationSeconds: order.estimatedDurationSeconds,
      quotedPriceToman: Number(order.quotedPrice),
      finalPriceToman: order.finalPrice === null ? null : Number(order.finalPrice),
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
