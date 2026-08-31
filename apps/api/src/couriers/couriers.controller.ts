import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CouriersService } from './couriers.service';
import { UpdateCourierAvailabilityDto } from './dto/update-availability.dto';
import { UpdateCourierLocationDto } from './dto/update-location.dto';

@Controller('courier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COURIER')
export class CouriersController {
  constructor(private readonly couriers: CouriersService) {}

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
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCourierLocationDto,
  ) {
    return this.couriers.updateLocation(user.id, dto);
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
  acceptOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    return this.couriers.acceptOrder(user.id, orderId);
  }

  @Post('orders/:id/reject')
  rejectAssignedOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    return this.couriers.rejectAssignedOrder(user.id, orderId);
  }

  @Post('orders/:id/picked-up')
  markPickedUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    return this.couriers.markPickedUp(user.id, orderId);
  }

  @Post('orders/:id/delivered')
  markDelivered(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
  ) {
    return this.couriers.markDelivered(user.id, orderId);
  }
}
