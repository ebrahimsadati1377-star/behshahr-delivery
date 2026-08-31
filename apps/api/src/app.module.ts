import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
})
export class AppModule {}
