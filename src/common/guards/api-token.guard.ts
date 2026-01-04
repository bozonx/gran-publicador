import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { ApiTokensService } from '../../modules/api-tokens/api-tokens.service.js';
import type { ApiTokenRequest } from '../types/api-token-user.interface.js';

/**
 * Guard to protect External API endpoints with user API tokens.
 * Validates the token and adds user information to the request.
 */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  private readonly logger = new Logger(ApiTokenGuard.name);
  private static readonly scopeLogger = new Logger('ApiTokenScope');

  constructor(private apiTokensService: ApiTokensService) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('API token is missing');
    }

    const tokenData = await this.apiTokensService.validateToken(token);

    if (!tokenData) {
      this.logger.warn(`Invalid API token attempt from IP: ${request.ip}`);
      throw new UnauthorizedException('Invalid API token');
    }

    // Add user info and scope to request for use in controllers
    (request as unknown as ApiTokenRequest).user = {
      userId: tokenData.userId,
      scopeProjectIds: tokenData.scopeProjectIds,
      tokenId: tokenData.tokenId,
    };

    // Update last used timestamp asynchronously (don't block the request)
    this.apiTokensService.updateLastUsed(tokenData.tokenId).catch(() => {
      // Silently fail - this is not critical
    });

    return true;
  }

  private extractToken(request: FastifyRequest): string | undefined {
    // Try to get token from x-api-key header
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    // Try to get token from Authorization header (Bearer)
    const authHeader = request.headers['authorization'];
    if (authHeader && !Array.isArray(authHeader) && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }

  /**
   * Helper method to check if a project is in the token's scope.
   * Can be called from controllers to validate project access.
   */
  public static validateProjectScope(
    projectId: string,
    scopeProjectIds: string[],
    context?: { userId: string; tokenId?: string },
  ): void {
    // Empty scope means all projects are allowed
    if (scopeProjectIds.length === 0) {
      return;
    }

    if (!scopeProjectIds.includes(projectId)) {
      this.scopeLogger.warn(
        `Unauthorized project access blocked! User: ${context?.userId}, TokenUID: ${context?.tokenId}, ProjectID: ${projectId}. Allowed: [${scopeProjectIds.join(', ')}]`,
      );
      throw new ForbiddenException('Access denied: project not in token scope');
    }
  }
}
