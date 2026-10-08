import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { WooAssignCourierDto } from './dto/woo-assign-courier.dto';
import { WooAssignmentLookupDto } from './dto/woo-assignment-lookup.dto';
import { CreateWooCommerceOrderDto } from './dto/create-woocommerce-order.dto';
import { UpdateWooCommerceOrderStatusDto } from './dto/update-woocommerce-order-status.dto';
import { WooCommerceIntegrationService } from './woocommerce-integration.service';

@Controller('integrations/woocommerce')
export class WooCommerceIntegrationController {
  constructor(private readonly integration: WooCommerceIntegrationService) {}

  @Get('couriers')
  availableCouriers(@Headers('x-delivery-key') apiKey: string | undefined) {
    return this.integration.availableCouriers(apiKey);
  }

  @Get('orders/assignment')
  assignment(
    @Headers('x-delivery-key') apiKey: string | undefined,
    @Query() query: WooAssignmentLookupDto,
  ) {
    return this.integration.orderAssignment(apiKey, query);
  }

  @Post('orders/assign')
  assignCourier(
    @Headers('x-delivery-key') apiKey: string | undefined,
    @Body() dto: WooAssignCourierDto,
  ) {
    return this.integration.assignCourier(apiKey, dto);
  }

  @Post('orders')
  createOrder(
    @Headers('x-delivery-key') apiKey: string | undefined,
    @Body() dto: CreateWooCommerceOrderDto,
  ) {
    return this.integration.createOrder(apiKey, dto);
  }

  @Post('orders/status')
  updateOrderStatus(
    @Headers('x-delivery-key') apiKey: string | undefined,
    @Body() dto: UpdateWooCommerceOrderStatusDto,
  ) {
    return this.integration.updateOrderStatus(apiKey, dto);
  }
}
