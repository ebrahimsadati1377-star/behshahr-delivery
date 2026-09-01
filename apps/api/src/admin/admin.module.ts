import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminPricingService } from './admin-pricing.service';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminPricingService],
})
export class AdminModule {}
