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
    const ip = this.normalizeIp(request.ip);

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
    if (ip === '127.0.0.1' || ip === '::1') {
      return true;
    }

    // IPv4-mapped IPv6 like ::ffff:192.168.0.1 is normalized to plain IPv4.
    // If it is still present here for some reason, fail closed.
    if (ip.startsWith('::ffff:')) {
      return false;
    }

    // IPv6 local / private
    // Link-local: fe80::/10
    if (ip.startsWith('fe80:')) {
      return true;
    }

    // Unique local address (ULA): fc00::/7
    if (ip.startsWith('fc') || ip.startsWith('fd')) {
      return true;
    }

    // If it looks like IPv6 and it isn't one of the local ranges above, deny.
    if (ip.includes(':')) {
      return false;
    }

    // IPv4 Private Ranges (RFC 1918)
    const ipv4 = this.parseIpv4(ip);
    if (!ipv4) {
      return false;
    }

    const [a, b] = ipv4;

    // 10.0.0.0/8
    if (a === 10) {
      return true;
    }

    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    // 192.168.0.0/16
    if (a === 192 && b === 168) {
      return true;
    }

    return false;
  }

  private normalizeIp(ip: string): string {
    const trimmed = ip.trim();

    // Fastify can expose IPv4-mapped IPv6 like ::ffff:127.0.0.1
    if (trimmed.startsWith('::ffff:')) {
      const candidate = trimmed.substring('::ffff:'.length);
      return this.parseIpv4(candidate) ? candidate : trimmed;
    }

    return trimmed;
  }

  private parseIpv4(ip: string): [number, number, number, number] | null {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return null;
    }

    const nums: number[] = [];
    for (const part of parts) {
      if (part.length === 0 || part.length > 3) {
        return null;
      }

      const num = Number(part);
      if (!Number.isInteger(num) || num < 0 || num > 255) {
        return null;
      }
      nums.push(num);
    }

    return nums as [number, number, number, number];
  }
}
