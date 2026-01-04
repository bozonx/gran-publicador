import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { FastifyRequest } from 'fastify';

import { JWT_STRATEGY } from '../constants/auth.constants.js';
import type { JwtPayload } from '../types/jwt-payload.interface.js';
import type { UnifiedAuthRequest } from '../types/unified-auth-request.interface.js';
import { ApiTokenGuard } from './api-token.guard.js';

/**
 * Combined authentication guard that supports both JWT and API token authentication.
 * - If an API token is present (x-api-key or Authorization: Bearer), uses API token auth
 * - Otherwise, uses JWT authentication
 * - Normalizes the user object to a unified format for controllers
 */
@Injectable()
export class JwtOrApiTokenGuard implements CanActivate {
  constructor(private apiTokenGuard: ApiTokenGuard) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Check if API token is present
    const apiToken = this.extractApiToken(request);

    if (apiToken) {
      // Use API token authentication
      const isValid = await this.apiTokenGuard.canActivate(context);
      if (!isValid) {
        return false;
      }

      // Normalize the user object to unified format
      const apiTokenRequest = request as any;
      const unifiedRequest = request as unknown as UnifiedAuthRequest;
      unifiedRequest.user = {
        userId: apiTokenRequest.user.userId,
        scopeProjectIds: apiTokenRequest.user.scopeProjectIds,
        tokenId: apiTokenRequest.user.tokenId,
      };

      return true;
    }

    // Use JWT authentication
    const jwtGuard = new (AuthGuard(JWT_STRATEGY))();
    const isValid = await jwtGuard.canActivate(context);
    if (!isValid) {
      throw new UnauthorizedException('Authentication required');
    }

    // Normalize JWT payload to unified format
    const jwtRequest = request as any;
    const jwtPayload = jwtRequest.user as JwtPayload;
    const unifiedRequest = request as unknown as UnifiedAuthRequest;
    unifiedRequest.user = {
      userId: jwtPayload.sub,
      scopeProjectIds: undefined, // JWT users have access to all their projects
      tokenId: undefined,
    };

    return true;
  }

  private extractApiToken(request: FastifyRequest): string | undefined {
    // Try to get token from x-api-key header
    const headerKey = request.headers['x-api-key'];
    if (headerKey) {
      return Array.isArray(headerKey) ? headerKey[0] : headerKey;
    }

    // Try to get token from Authorization header (Bearer)
    const authHeader = request.headers['authorization'];
    if (authHeader && !Array.isArray(authHeader) && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Check for our API token prefix for reliable identification
      if (token.startsWith('gpt_')) {
        return token;
      }

      // Fallback heuristic for safety: JWT tokens have 3 parts separated by dots,
      // while legacy API tokens don't.
      if (token.split('.').length !== 3) {
        return token;
      }
    }

    return undefined;
  }
}
