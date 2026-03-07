import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_SCOPES_KEY } from '../decorators/require-scopes.decorator.js';
import type { ApiTokenRequest } from '../types/api-token-user.interface.js';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiTokenRequest>();
    const user = request.user;

    if (!user || !user.scopes) {
      throw new ForbiddenException('Access denied: no scopes authorized');
    }

    const hasAllScopes = requiredScopes.every(scope => user.scopes.includes(scope));

    if (!hasAllScopes) {
      const missingScopes = requiredScopes.filter(scope => !user.scopes.includes(scope));
      throw new ForbiddenException(
        `Access denied: missing required scopes [${missingScopes.join(', ')}]`,
      );
    }

    return true;
  }
}
