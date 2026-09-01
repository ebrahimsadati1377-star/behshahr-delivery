import { Module } from '@nestjs/common';
import { OrdersModule } from '../../orders/orders.module';
import { QuotesModule } from '../../quotes/quotes.module';
import { WooCommerceIntegrationController } from './woocommerce-integration.controller';
import { WooCommerceIntegrationService } from './woocommerce-integration.service';

@Module({
  imports: [QuotesModule, OrdersModule],
  controllers: [WooCommerceIntegrationController],
  providers: [WooCommerceIntegrationService],
})
export class WooCommerceIntegrationModule {}
