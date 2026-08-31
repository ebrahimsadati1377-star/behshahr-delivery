import { Module } from '@nestjs/common';
import { AddressesModule } from './addresses/addresses.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { GeoModule } from './geo/geo.module';
import { HealthController } from './health.controller';
import { QuotesModule } from './quotes/quotes.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    AuthModule,
    GeoModule,
    AddressesModule,
    QuotesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
