import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CreateWooCommerceOrderDto } from './dto/create-woocommerce-order.dto';
import { UpdateWooCommerceOrderStatusDto } from './dto/update-woocommerce-order-status.dto';
import { WooCommerceIntegrationService } from './woocommerce-integration.service';

@Controller('integrations/woocommerce')
export class WooCommerceIntegrationController {
  constructor(private readonly integration: WooCommerceIntegrationService) {}

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
