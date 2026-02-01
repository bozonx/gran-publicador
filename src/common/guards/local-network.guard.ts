import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app.config.js';

/**
 * Guard that restricts access to local network IPs (RFC 1918) and localhost.
 * Can be disabled via SYSTEM_API_IP_RESTRICTION_ENABLED config.
 */
@Injectable()
export class LocalNetworkGuard implements CanActivate {
  private readonly logger = new Logger(LocalNetworkGuard.name);

  constructor(private readonly configService: ConfigService) {}

  public canActivate(context: ExecutionContext): boolean {
    const config = this.configService.get<AppConfig>('app')!;
    
    // Skip check if disabled in config
    if (!config.systemApiIpRestrictionEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const ip = request.ip;

    if (this.isLocalNetwork(ip)) {
      return true;
    }

    this.logger.warn(`Access denied to system API from non-local IP: ${ip}`);
    throw new ForbiddenException('Access denied: non-local IP');
  }

  /**
   * Checks if an IP address belongs to a local network range or is localhost.
   */
  private isLocalNetwork(ip: string): boolean {
    // Localhost
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }

    // IPv4 Private Ranges (RFC 1918)
    // 10.0.0.0 - 10.255.255.255
    if (ip.startsWith('10.')) {
      return true;
    }

    // 172.16.0.0 - 172.31.255.255
    if (ip.startsWith('172.')) {
      const parts = ip.split('.');
      if (parts.length >= 2) {
        const secondPart = parseInt(parts[1], 10);
        if (secondPart >= 16 && secondPart <= 31) {
          return true;
        }
      }
    }

    // 192.168.0.0 - 192.168.255.255
    if (ip.startsWith('192.168.')) {
      return true;
    }

    // Docker internal network (often 172.x, covered above)
    // but also check for typical IPv6 local addresses if needed (fe80::, etc.)
    if (ip.startsWith('fe80:')) {
      return true;
    }

    return false;
  }
}
