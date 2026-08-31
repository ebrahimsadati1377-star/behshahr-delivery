import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { AccessTokenPayload, AppRole, AuthenticatedUser } from '../auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthenticatedUser;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const secret = process.env.JWT_ACCESS_SECRET;

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }

    let payload: AccessTokenPayload;

    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    if (
      payload.type !== 'access' ||
      !payload.sub ||
      !this.isRole(payload.role)
    ) {
      throw new UnauthorizedException('Invalid access token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is not active');
    }

    request.user = {
      id: user.id,
      phone: user.phone,
      role: user.role as AppRole,
    };

    return true;
  }

  private extractBearerToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  private isRole(value: unknown): value is AppRole {
    return value === 'CUSTOMER' || value === 'COURIER' || value === 'ADMIN';
  }
}
