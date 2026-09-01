import { Module } from '@nestjs/common';
import { AddressesModule } from './addresses/addresses.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CouriersModule } from './couriers/couriers.module';
import { DatabaseModule } from './database/database.module';
import { GeoModule } from './geo/geo.module';
import { HealthController } from './health.controller';
import { WooCommerceIntegrationModule } from './integrations/woocommerce/woocommerce-integration.module';
import { OrdersModule } from './orders/orders.module';
import { QuotesModule } from './quotes/quotes.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    RealtimeModule,
    AuthModule,
    GeoModule,
    AddressesModule,
    QuotesModule,
    OrdersModule,
    CouriersModule,
    AdminModule,
    WooCommerceIntegrationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
