import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { SmsProvider } from './sms/sms.provider';

@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    ConsoleSmsProvider,
    {
      provide: SmsProvider,
      useExisting: ConsoleSmsProvider,
    },
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
