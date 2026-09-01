import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrderRealtimeService } from '../realtime/order-realtime.service';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';

@Injectable()
export class AdminPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  async markPaid(adminId: string, orderId: string, dto: MarkPaymentPaidDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!order.payment) throw new NotFoundException('Payment not found');

    if (order.payment.status === 'PAID') {
      return this.serialize(order.payment);
    }
    if (order.payment.status !== 'PENDING') {
      throw new ConflictException(
        `Payment cannot be marked paid from ${order.payment.status}`,
      );
    }

    const paidAt = new Date();
    const payment = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.updateMany({
        where: { id: order.payment!.id, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt,
          providerReference: dto.reference?.trim() || null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException('Payment state changed; reload and try again');
      }

      await tx.paymentEvent.create({
        data: {
          paymentId: order.payment!.id,
          actorType: 'ADMIN',
          actorId: adminId,
          eventType: 'PAYMENT_MARKED_PAID',
          fromStatus: 'PENDING',
          toStatus: 'PAID',
          metadata: dto.reference?.trim()
            ? { reference: dto.reference.trim() }
            : undefined,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          actorType: 'ADMIN',
          actorId: adminId,
          eventType: 'ORDER_PAYMENT_MARKED_PAID',
          metadata: {
            paymentId: order.payment!.id,
            method: order.payment!.method,
            amountToman: Number(order.payment!.amount),
          },
        },
      });

      return tx.payment.findUniqueOrThrow({ where: { id: order.payment!.id } });
    });

    this.realtime.publish(orderId, 'PAYMENT_STATUS');
    return this.serialize(payment);
  }

  private serialize(payment: {
    id: string;
    orderId: string;
    method: string;
    status: string;
    amount: bigint;
    provider: string | null;
    providerReference: string | null;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
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
