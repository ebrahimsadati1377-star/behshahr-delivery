import { Module } from '@nestjs/common';
import { QuotesModule } from '../quotes/quotes.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [QuotesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
