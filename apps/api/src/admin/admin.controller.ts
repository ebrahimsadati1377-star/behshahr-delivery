import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderRealtimeService } from '../realtime/order-realtime.service';
import { AdminCourierService } from './admin-courier.service';
import { CreateCourierDto } from './dto/create-courier.dto';
import { UpdateCourierDto } from './dto/update-courier.dto';
import { AdminPaymentService } from './admin-payment.service';
import { AdminPricingService } from './admin-pricing.service';
import { AdminServiceZoneService } from './admin-service-zone.service';
import { AdminService } from './admin.service';
import { AssignOrderDto } from './dto/assign-order.dto';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';
import { MarkPaymentPaidDto } from './dto/mark-payment-paid.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly courierManagement: AdminCourierService,
    private readonly payments: AdminPaymentService,
    private readonly pricing: AdminPricingService,
    private readonly serviceZones: AdminServiceZoneService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  @Get('orders')
  orders() {
    return this.admin.orders();
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.admin.order(id);
  }

  @Get('couriers')
  couriers() {
    return this.courierManagement.list();
  }

  @Post('couriers')
  createCourier(@CurrentUser() admin: AuthenticatedUser, @Body() dto: CreateCourierDto) {
    return this.courierManagement.create(admin.id, dto);
  }

  @Patch('couriers/:id')
  updateCourier(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCourierDto,
  ) {
    return this.courierManagement.update(admin.id, id, dto);
  }

  @Post('couriers/:id/suspend')
  suspendCourier(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.courierManagement.suspend(admin.id, id);
  }

  @Post('couriers/:id/activate')
  activateCourier(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.courierManagement.activate(admin.id, id);
  }

  @Get('pricing-rules')
  pricingRules() {
    return this.pricing.list();
  }

  @Post('pricing-rules')
  createPricingRule(@Body() dto: CreatePricingRuleDto) {
    return this.pricing.create(dto);
  }

  @Post('pricing-rules/:id/deactivate')
  deactivatePricingRule(@Param('id') id: string) {
    return this.pricing.deactivate(id);
  }

  @Get('service-zones')
  serviceZoneList() {
    return this.serviceZones.list();
  }

  @Post('service-zones')
  createServiceZone(@Body() dto: CreateServiceZoneDto) {
    return this.serviceZones.create(dto);
  }

  @Post('service-zones/:id/activate')
  activateServiceZone(@Param('id') id: string) {
    return this.serviceZones.activate(id);
  }

  @Post('service-zones/:id/deactivate')
  deactivateServiceZone(@Param('id') id: string) {
    return this.serviceZones.deactivate(id);
  }

  @Post('orders/:id/payment/paid')
  markPaymentPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: MarkPaymentPaidDto,
  ) {
    return this.payments.markPaid(user.id, orderId, dto);
  }

  @Post('orders/:id/assign')
  async assignOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: AssignOrderDto,
  ) {
    const result = await this.admin.assignOrder(user.id, orderId, dto);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }

  @Post('orders/:id/reassign')
  async reassignOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') orderId: string,
    @Body() dto: AssignOrderDto,
  ) {
    const result = await this.admin.reassignOrder(user.id, orderId, dto);
    this.realtime.publish(orderId, 'ORDER_STATUS');
    return result;
  }
}
