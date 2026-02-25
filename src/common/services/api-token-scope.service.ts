import { Injectable } from '@nestjs/common';

import { ApiTokenGuard } from '../guards/api-token.guard.js';
import type { UnifiedAuthRequest } from '../types/unified-auth-request.interface.js';

@Injectable()
export class ApiTokenScopeService {
  public validateProjectScopeOrThrow(req: UnifiedAuthRequest, projectId: string): void {
    if (req.user.allProjects === undefined) {
      return;
    }

    ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
      userId: req.user.userId,
      tokenId: req.user.tokenId,
    });
  }

  public validateManyProjectScopesOrThrow(req: UnifiedAuthRequest, projectIds: string[]): void {
    if (req.user.allProjects === undefined) {
      return;
    }

    for (const projectId of projectIds) {
      ApiTokenGuard.validateProjectScope(
        projectId,
        req.user.allProjects,
        req.user.projectIds ?? [],
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }
  }
}
