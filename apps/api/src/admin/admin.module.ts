import { Module } from '@nestjs/common';
import { AdminPaymentService } from './admin-payment.service';
import { AdminPricingService } from './admin-pricing.service';
import { AdminServiceZoneService } from './admin-service-zone.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [
    AdminService,
    AdminPaymentService,
    AdminPricingService,
    AdminServiceZoneService,
  ],
})
export class AdminModule {}
