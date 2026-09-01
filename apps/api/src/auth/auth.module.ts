import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { IpPanelSmsProvider } from './sms/ippanel-sms.provider';
import { SmsProvider } from './sms/sms.provider';

@Module({
  imports: [JwtModule.register({ global: true })],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    ConsoleSmsProvider,
    IpPanelSmsProvider,
    {
      provide: SmsProvider,
      inject: [ConsoleSmsProvider, IpPanelSmsProvider],
      useFactory: (
        consoleProvider: ConsoleSmsProvider,
        ipPanelProvider: IpPanelSmsProvider,
      ): SmsProvider => {
        const provider = (process.env.SMS_PROVIDER ?? 'console').trim().toLowerCase();

        if (provider === 'ippanel') return ipPanelProvider;
        if (provider === 'console') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error('SMS_PROVIDER=console is not allowed in production');
          }
          return consoleProvider;
        }

        throw new Error('SMS_PROVIDER must be console or ippanel');
      },
    },
  ],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
