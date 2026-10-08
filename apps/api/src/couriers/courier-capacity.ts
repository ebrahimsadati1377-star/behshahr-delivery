import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

export const COURIER_ACTIVE_ORDER_LIMIT = 5;
const ACTIVE = ['ASSIGNED', 'PICKED_UP'] as const;

export async function reserveCourierSlot(tx: Prisma.TransactionClient, courierId: string) {
  // Updating the courier row serializes simultaneous assignments to the same driver.
  const claimed = await tx.courier.updateMany({
    where: { id: courierId, status: { in: ['AVAILABLE', 'BUSY'] }, user: { status: 'ACTIVE' } },
    data: { status: 'BUSY' },
  });
  if (claimed.count !== 1) throw new ConflictException('Courier must be online and active');
  const count = await tx.order.count({ where: { courierId, status: { in: [...ACTIVE] } } });
  if (count >= COURIER_ACTIVE_ORDER_LIMIT) {
    throw new ConflictException('Courier active order capacity reached');
  }
}

export async function releaseCourierIfIdle(tx: Prisma.TransactionClient, courierId: string) {
  return tx.courier.updateMany({
    where: { id: courierId, status: 'BUSY',
      orders: { none: { status: { in: [...ACTIVE] } } },
    },
    data: { status: 'AVAILABLE' },
  });
}
