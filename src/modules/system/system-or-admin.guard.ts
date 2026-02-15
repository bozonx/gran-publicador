import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { LocalNetworkGuard } from '../../common/guards/local-network.guard.js';
import { SystemAuthGuard } from '../../common/guards/system-auth.guard.js';
import { UsersService } from '../users/users.service.js';

/**
 * Guard that allows either:
 * - system-to-system auth via x-system-token (+ local network restriction), or
 * - regular JWT auth for an application admin user.
 */
@Injectable()
export class SystemOrAdminGuard implements CanActivate {
  constructor(
    private readonly localNetworkGuard: LocalNetworkGuard,
    private readonly systemAuthGuard: SystemAuthGuard,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly usersService: UsersService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const hasSystemToken = Boolean(request.headers['x-system-token']);

    if (hasSystemToken) {
      const isLocalNetworkAllowed = await Promise.resolve(
        this.localNetworkGuard.canActivate(context),
      );
      if (!isLocalNetworkAllowed) {
        return false;
      }

      return this.systemAuthGuard.canActivate(context);
    }

    const isJwtAllowed = await Promise.resolve(this.jwtAuthGuard.canActivate(context));
    if (!isJwtAllowed) {
      return false;
    }

    const user = (request as any).user;
    const userId = user?.sub || user?.id;
    if (!userId) {
      throw new ForbiddenException('Admin access required');
    }

    const dbUser = await this.usersService.findById(userId);
    if (!dbUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
