import { Module } from '@nestjs/common';
import { AdminPricingService } from './admin-pricing.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminPricingService],
})
export class AdminModule {}
