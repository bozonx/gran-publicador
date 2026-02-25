import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PROJECT_SCOPE_KEY,
  type ProjectScopeOptions,
} from '../decorators/project-scope.decorator.js';
import { ApiTokenScopeService } from '../services/api-token-scope.service.js';
import type { UnifiedAuthRequest } from '../types/unified-auth-request.interface.js';

@Injectable()
export class ProjectScopeGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private apiTokenScope: ApiTokenScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<ProjectScopeOptions>(PROJECT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<UnifiedAuthRequest>();
    const { param, source } = options;

    let projectId: string | undefined;

    if (source === 'body') {
      projectId = (request.body as Record<string, any>)?.[param!];
    } else if (source === 'query') {
      projectId = (request.query as Record<string, any>)?.[param!];
    } else if (source === 'params') {
      projectId = (request.params as Record<string, any>)?.[param!];
    }

    // Skip if projectId is not provided (some endpoints might have it optional)
    if (!projectId) {
      return true;
    }

    if (typeof projectId !== 'string') {
      throw new BadRequestException(`${param} must be a string`);
    }

    this.apiTokenScope.validateProjectScopeOrThrow(request, projectId);

    return true;
  }
}
