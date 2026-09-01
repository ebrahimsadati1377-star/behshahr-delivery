import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderRealtimeService } from '../realtime/order-realtime.service';
import { CouriersService } from './couriers.service';
import { UpdateCourierAvailabilityDto } from './dto/update-availability.dto';
import { UpdateCourierLocationDto } from './dto/update-location.dto';

@Controller('courier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COURIER')
export class CouriersController {
  constructor(
    private readonly couriers: CouriersService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.couriers.profile(user.id);
  }

  @Patch('availability')
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierAvailabilityDto,
  ) {
    return this.couriers.updateAvailability(user.id, dto);
  }

  @Post('location')
  async updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierLocationDto,
  ) {
    const result = await this.couriers.updateLocation(user.id, dto);
    const activeOrder = await this.couriers.currentOrder(user.id);
    if (activeOrder) {
      this.realtime.publish(activeOrder.id, 'COURIER_LOCATION');
    }
    return result;
  }

  @Get('orders/available')
  availableOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.couriers.availableOrders(user.id);
  }

  @Get('orders/current')
  currentOrder(@CurrentUser() user: AuthenticatedUser) {
    return this.couriers.currentOrder(user.id);
  }

  @Post('orders/:id/accept')
  async acceptOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const result = await this.couriers.acceptOrder(user.id, orderId);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }

  @Post('orders/:id/reject')
  async rejectAssignedOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const result = await this.couriers.rejectAssignedOrder(user.id, orderId);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }

  @Post('orders/:id/picked-up')
  async markPickedUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const result = await this.couriers.markPickedUp(user.id, orderId);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }

  @Post('orders/:id/delivered')
  async markDelivered(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    const result = await this.couriers.markDelivered(user.id, orderId);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }
}
