import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../config/app.config.js';

/**
 * Guard that validates a shared secret in the X-System-Token header.
 * Used for system-level integrations (e.g., n8n).
 */
@Injectable()
export class SystemAuthGuard implements CanActivate {
  private readonly logger = new Logger(SystemAuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const config = this.configService.get<AppConfig>('app')!;
    const systemSecret = config.systemApiSecret;

    if (!systemSecret) {
      this.logger.error('SYSTEM_API_SECRET is not configured. System API is disabled.');
      throw new UnauthorizedException('System API is not configured');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-system-token'];

    if (!token) {
      throw new UnauthorizedException('System token is missing');
    }

    const tokenValue = Array.isArray(token) ? token[0] : token;
    if (typeof tokenValue !== 'string') {
      throw new UnauthorizedException('System token is missing');
    }

    if (!this.safeEquals(tokenValue, systemSecret)) {
      this.logger.warn(`Invalid system token attempt from IP: ${request.ip}`);
      throw new UnauthorizedException('Invalid system token');
    }

    return true;
  }

  private safeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      return false;
    }

    return timingSafeEqual(aBuf, bBuf);
  }
}
