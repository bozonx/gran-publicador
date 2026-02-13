import { BadRequestException, Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { TagsService } from './tags.service.js';
import { SearchTagsQueryDto } from './dto/index.js';

@Controller('tags')
@UseGuards(JwtOrApiTokenGuard)
export class TagsController {
  constructor(
    private readonly tagsService: TagsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('search')
  public async search(@Request() req: UnifiedAuthRequest, @Query() query: SearchTagsQueryDto) {
    const hasProjectId = Boolean(query.projectId);
    const hasUserId = Boolean(query.userId);

    if (hasProjectId === hasUserId) {
      throw new BadRequestException('Exactly one of projectId or userId must be provided');
    }

    if (query.userId) {
      if (query.userId !== req.user.userId) {
        throw new BadRequestException('userId must match the authenticated user');
      }
      return this.tagsService.search(query);
    }

    // projectId scope
    if (req.user.allProjects !== undefined) {
      ApiTokenGuard.validateProjectScope(
        query.projectId!,
        req.user.allProjects,
        req.user.projectIds ?? [],
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    } else {
      await this.permissions.checkProjectAccess(query.projectId!, req.user.userId);
    }

    return this.tagsService.search(query);
  }
}
