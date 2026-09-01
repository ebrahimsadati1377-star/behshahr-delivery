import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { OrderRealtimeService } from '../realtime/order-realtime.service';
import { AdminPricingService } from './admin-pricing.service';
import { AdminService } from './admin.service';
import { AssignOrderDto } from './dto/assign-order.dto';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly pricing: AdminPricingService,
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
    return this.admin.couriers();
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
