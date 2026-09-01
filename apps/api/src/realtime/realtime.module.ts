import { Global, Module } from '@nestjs/common';
import { OrderRealtimeService } from './order-realtime.service';

@Global()
@Module({
  providers: [OrderRealtimeService],
  exports: [OrderRealtimeService],
})
export class RealtimeModule {}
