import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  createHash,
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  AccessTokenPayload,
  AppRole,
  RefreshTokenPayload,
} from './auth.types';
import { SmsProvider } from './sms/sms.provider';

const OTP_TTL_SECONDS = 5 * 60;
const OTP_COOLDOWN_SECONDS = 60;
const OTP_MAX_REQUESTS_PER_HOUR = 5;
const OTP_MAX_VERIFY_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly smsProvider: SmsProvider,
  ) {}

  async requestOtp(dto: RequestOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const fingerprint = this.phoneFingerprint(phone);
    const cooldownKey = `auth:otp:cooldown:${fingerprint}`;
    const codeKey = `auth:otp:code:${fingerprint}`;
    const attemptsKey = `auth:otp:attempts:${fingerprint}`;

    const acquired = await this.redis.setIfAbsent(
      cooldownKey,
      '1',
      OTP_COOLDOWN_SECONDS,
    );

    if (!acquired) {
      throw new HttpException(
        'Please wait before requesting another code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const hourlyKey = `auth:otp:hour:${fingerprint}:${hourBucket}`;
    const hourlyCount = await this.redis.incrementWithExpiry(hourlyKey, 3_600);

    if (hourlyCount > OTP_MAX_REQUESTS_PER_HOUR) {
      await this.redis.delete(cooldownKey);
      throw new HttpException(
        'Too many OTP requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const code = this.generateOtp();
    const digest = this.otpDigest(phone, code);

    await Promise.all([
      this.redis.setEx(codeKey, OTP_TTL_SECONDS, digest),
      this.redis.delete(attemptsKey),
    ]);

    try {
      await this.smsProvider.sendOtp(phone, code);
    } catch (error) {
      await this.redis.delete(codeKey, attemptsKey, cooldownKey);
      throw error;
    }

    return {
      status: 'sent',
      expiresInSeconds: OTP_TTL_SECONDS,
      retryAfterSeconds: OTP_COOLDOWN_SECONDS,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const phone = this.normalizePhone(dto.phone);
    const fingerprint = this.phoneFingerprint(phone);
    const codeKey = `auth:otp:code:${fingerprint}`;
    const attemptsKey = `auth:otp:attempts:${fingerprint}`;

    const attempts = await this.redis.incrementWithExpiry(
      attemptsKey,
      OTP_TTL_SECONDS,
    );

    if (attempts > OTP_MAX_VERIFY_ATTEMPTS) {
      await this.redis.delete(codeKey);
      throw new HttpException(
        'Too many verification attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const storedDigest = await this.redis.get(codeKey);

    if (!storedDigest || !this.matchesOtp(phone, dto.code, storedDigest)) {
      throw new UnauthorizedException('Invalid or expired verification code');
    }

    await this.redis.delete(codeKey, attemptsKey);

    const user = await this.prisma.user.upsert({
      where: { phone },
      create: { phone },
      update: { phone },
    });

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    return this.issueSession({
      id: user.id,
      phone: user.phone,
      role: user.role as AppRole,
    });
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyRefreshToken(dto.refreshToken);
    const sessionKey = this.refreshSessionKey(payload.jti);
    const storedUserId = await this.redis.get(sessionKey);

    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh session is not active');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      await this.redis.delete(sessionKey);
      throw new UnauthorizedException('User account is not active');
    }

    await this.redis.delete(sessionKey);

    return this.issueSession({
      id: user.id,
      phone: user.phone,
      role: user.role as AppRole,
    });
  }

  async logout(dto: RefreshTokenDto) {
    try {
      const payload = await this.verifyRefreshToken(dto.refreshToken);
      await this.redis.delete(this.refreshSessionKey(payload.jti));
    } catch {
      // Logout is intentionally idempotent and does not reveal token state.
    }

    return { status: 'logged_out' };
  }

  private async issueSession(user: {
    id: string;
    phone: string;
    role: AppRole;
  }) {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'access',
    };
    const refreshJti = randomUUID();
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      role: user.role,
      type: 'refresh',
      jti: refreshJti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.requiredEnv('JWT_ACCESS_SECRET'),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.requiredEnv('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
      }),
    ]);

    await this.redis.setEx(
      this.refreshSessionKey(refreshJti),
      REFRESH_TOKEN_TTL_SECONDS,
      user.id,
    );

    return {
      user,
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenExpiresInSeconds: REFRESH_TOKEN_TTL_SECONDS,
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.requiredEnv('JWT_REFRESH_SECRET'),
      });

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.jti ||
        !this.isRole(payload.role)
      ) {
        throw new Error('Invalid refresh payload');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateOtp(): string {
    const configuredCode = process.env.DEV_OTP_CODE;

    if (
      process.env.NODE_ENV !== 'production' &&
      configuredCode &&
      /^\d{6}$/.test(configuredCode)
    ) {
      return configuredCode;
    }

    return randomInt(100000, 1000000).toString();
  }

  private normalizePhone(input: string): string {
    if (/^09\d{9}$/.test(input)) {
      return `+98${input.slice(1)}`;
    }

    if (/^989\d{9}$/.test(input)) {
      return `+${input}`;
    }

    if (/^\+989\d{9}$/.test(input)) {
      return input;
    }

    throw new BadRequestException('Invalid Iranian mobile number');
  }

  private phoneFingerprint(phone: string): string {
    return createHash('sha256').update(phone).digest('hex').slice(0, 32);
  }

  private otpDigest(phone: string, code: string): string {
    return createHmac('sha256', this.requiredEnv('OTP_SECRET'))
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  private matchesOtp(phone: string, code: string, storedDigest: string): boolean {
    const candidate = Buffer.from(this.otpDigest(phone, code), 'hex');
    const stored = Buffer.from(storedDigest, 'hex');

    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }

  private refreshSessionKey(jti: string): string {
    return `auth:refresh:${jti}`;
  }

  private requiredEnv(name: string): string {
    const value = process.env[name];

    if (!value) {
      throw new Error(`${name} is required`);
    }

    return value;
  }

  private isRole(value: unknown): value is AppRole {
    return value === 'CUSTOMER' || value === 'COURIER' || value === 'ADMIN';
  }
}
