import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { COURIER_ACTIVE_ORDER_LIMIT } from '../couriers/courier-capacity';
import { Prisma } from '../generated/prisma/client';
import { CreateCourierDto } from './dto/create-courier.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';

function normalizePhone(phone: string): string {
  if (phone.startsWith('09')) return '+98' + phone.slice(1);
  return phone.startsWith('+') ? phone : '+' + phone;
}

// Iran currently observes UTC+03:30 year-round. Report trip totals by local delivery day.
function startOfTehranDay(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return new Date(value('year') + '-' + value('month') + '-' + value('day') + 'T00:00:00+03:30');
}

@Injectable()
export class AdminCourierService {
  private readonly logger = new Logger(AdminCourierService.name);
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [couriers, total, today, active] = await Promise.all([
      this.prisma.courier.findMany({
        include: { user: { select: { phone: true, status: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.order.groupBy({
        by: ['courierId'],
        where: { status: 'DELIVERED', courierId: { not: null } },
        _count: { _all: true },
        _sum: { finalPrice: true },
      }),
      this.prisma.order.groupBy({
        by: ['courierId'],
        where: { status: 'DELIVERED', courierId: { not: null }, deliveredAt: { gte: startOfTehranDay() } },
        _count: { _all: true },
        _sum: { finalPrice: true },
      }),
      this.prisma.order.groupBy({
        by: ['courierId'],
        where: { courierId: { not: null }, status: { in: ['ASSIGNED', 'PICKED_UP'] } },
        _count: { _all: true },
      }),
    ]);

    const totals = new Map(total.map((row) => [row.courierId, row]));
    const todays = new Map(today.map((row) => [row.courierId, row]));
    const actives = new Map(active.map((row) => [row.courierId, row._count._all]));
    return couriers.map((courier) => {
      const all = totals.get(courier.id);
      const day = todays.get(courier.id);
      return {
        id: courier.id,
        userId: courier.userId,
        fullName: courier.fullName ?? '',
        phone: courier.user.phone,
        userStatus: courier.user.status,
        vehicleType: courier.vehicleType,
        status: courier.status,
        activeOrders: actives.get(courier.id) ?? 0,
        maxActiveOrders: COURIER_ACTIVE_ORDER_LIMIT,
        lastLatitude: courier.lastLatitude === null ? null : Number(courier.lastLatitude),
        lastLongitude: courier.lastLongitude === null ? null : Number(courier.lastLongitude),
        lastSeenAt: courier.lastSeenAt,
        totalDeliveries: all?._count._all ?? 0,
        todayDeliveries: day?._count._all ?? 0,
        totalGrossFareToman: Number(all?._sum.finalPrice ?? 0),
        todayGrossFareToman: Number(day?._sum.finalPrice ?? 0),
        createdAt: courier.createdAt,
        updatedAt: courier.updatedAt,
      };
    });
  }

  async create(adminId: string, dto: CreateCourierDto) {
    const phone = normalizePhone(dto.phone);
    const fullName = dto.fullName.trim();
    if (fullName.length < 2) throw new ConflictException('Courier name is required');
    try {
      const courier = await this.prisma.$transaction(async (tx) => {
        // Never silently change a CUSTOMER or ADMIN account into a courier.
        if (await tx.user.findUnique({ where: { phone } })) {
          throw new ConflictException('This phone already belongs to an account');
        }
        const user = await tx.user.create({
          data: { phone, role: 'COURIER', status: 'ACTIVE' },
        });
        return tx.courier.create({
          data: { userId: user.id, fullName, vehicleType: dto.vehicleType, status: 'OFFLINE' },
        });
      });
      this.logger.log('courier_created admin=' + adminId + ' courier=' + courier.id);
      return { id: courier.id, phone, fullName, vehicleType: courier.vehicleType, status: courier.status };
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async update(adminId: string, id: string, dto: UpdateCourierDto) {
    const courier = await this.prisma.courier.findUnique({ where: { id }, include: { user: true } });
    if (!courier) throw new NotFoundException('Courier not found');
    const phone = dto.phone === undefined ? courier.user.phone : normalizePhone(dto.phone);
    const fullName = dto.fullName === undefined ? courier.fullName : dto.fullName.trim();
    if (fullName !== null && fullName.length < 2) throw new ConflictException('Courier name is too short');

    const vehicleChanging = dto.vehicleType !== undefined && dto.vehicleType !== courier.vehicleType;
    if (vehicleChanging) {
      const activeCount = await this.prisma.order.count({
        where: { courierId: id, status: { in: ['ASSIGNED', 'PICKED_UP'] } },
      });
      if (!['OFFLINE', 'SUSPENDED'].includes(courier.status) || activeCount > 0) {
        throw new ConflictException('Courier must be offline and have no active mission to change vehicle');
      }
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (phone !== courier.user.phone) {
          await tx.user.update({ where: { id: courier.userId }, data: { phone } });
        }
        if (vehicleChanging) {
          const changed = await tx.courier.updateMany({
            where: { id, status: { in: ['OFFLINE', 'SUSPENDED'] } },
            data: { vehicleType: dto.vehicleType, fullName },
          });
          if (changed.count !== 1) throw new ConflictException('Courier started a mission; retry later');
        } else {
          await tx.courier.update({ where: { id }, data: { fullName } });
        }
      });
      this.logger.log('courier_updated admin=' + adminId + ' courier=' + id);
      return { id, phone, fullName, vehicleType: dto.vehicleType ?? courier.vehicleType };
    } catch (error) {
      this.handleUniqueConflict(error);
      throw error;
    }
  }

  async suspend(adminId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const courier = await tx.courier.findUnique({ where: { id } });
      if (!courier) throw new NotFoundException('Courier not found');
      if (courier.status === 'SUSPENDED') throw new ConflictException('Courier is already suspended');
      if (courier.status === 'BUSY' || await tx.order.count({
        where: { courierId: id, status: { in: ['ASSIGNED', 'PICKED_UP'] } },
      })) throw new ConflictException('Finish or reassign the active mission before suspending');
      const updated = await tx.courier.updateMany({
        where: { id, status: { in: ['OFFLINE', 'AVAILABLE'] } },
        data: { status: 'SUSPENDED' },
      });
      if (updated.count !== 1) throw new ConflictException('Courier status changed; retry');
      await tx.user.update({ where: { id: courier.userId }, data: { status: 'SUSPENDED' } });
    });
    this.logger.log('courier_suspended admin=' + adminId + ' courier=' + id);
    return { id, status: 'SUSPENDED' };
  }

  async activate(adminId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const courier = await tx.courier.findUnique({ where: { id } });
      if (!courier) throw new NotFoundException('Courier not found');
      if (courier.status !== 'SUSPENDED') throw new ConflictException('Courier is not suspended');
      const updated = await tx.courier.updateMany({
        where: { id, status: 'SUSPENDED' },
        data: { status: 'OFFLINE' },
      });
      if (updated.count !== 1) throw new ConflictException('Courier status changed; retry');
      await tx.user.update({ where: { id: courier.userId }, data: { status: 'ACTIVE' } });
    });
    this.logger.log('courier_activated admin=' + adminId + ' courier=' + id);
    return { id, status: 'OFFLINE' };
  }

  private handleUniqueConflict(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('This phone number is already registered');
    }
  }
}
