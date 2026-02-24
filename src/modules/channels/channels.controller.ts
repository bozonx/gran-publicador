import {
  Body,
  Controller,
  UseGuards,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ApiTokenScopeService } from '../../common/services/api-token-scope.service.js';
import type { PaginatedResponse } from '../../common/dto/pagination-response.dto.js';
import { ChannelsService } from './channels.service.js';
import {
  CreateChannelDto,
  UpdateChannelDto,
  FindChannelsQueryDto,
  ChannelResponseDto,
} from './dto/index.js';
import { SocialPostingService } from '../social-posting/social-posting.service.js';

class UpsertChannelTemplateVariationBodyDto {
  @IsOptional()
  @IsBoolean()
  public excluded?: boolean;

  @IsOptional()
  @IsObject()
  public overrides?: Record<string, unknown>;
}

/**
 * Controller for managing channels within projects.
 */
@Controller('channels')
@UseGuards(JwtOrApiTokenGuard)
export class ChannelsController {
  private readonly MAX_LIMIT = 1000;

  constructor(
    private readonly channelsService: ChannelsService,
    private readonly socialPostingService: SocialPostingService,
    private readonly apiTokenScope: ApiTokenScopeService,
  ) {}

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createChannelDto: CreateChannelDto,
  ) {
    const { projectId, ...data } = createChannelDto;

    this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);

    return this.channelsService.create(req.user.userId, projectId, data);
  }

  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindChannelsQueryDto,
  ): Promise<PaginatedResponse<ChannelResponseDto>> {
    const {
      projectId,
      search,
      ownership,
      issueType,
      socialMedia,
      language,
      sortBy,
      sortOrder,
      limit = 50,
      offset = 0,
      includeArchived = false,
      archivedOnly = false,
    } = query;

    // Validate and cap limit
    const validatedLimit = Math.min(limit, this.MAX_LIMIT);

    const filters = {
      search,
      ownership,
      issueType,
      socialMedia,
      language,
      sortBy,
      sortOrder,
      limit: validatedLimit,
      offset,
      includeArchived,
      archivedOnly,
      projectIds: req.user.allProjects === false ? req.user.projectIds : undefined,
    };

    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);

      // Note: For project-specific queries, we could use findAllForProject
      // but for consistency, we use findAllForUser with projectIds filter
      filters.projectIds = [projectId];
    }

    const result = await this.channelsService.findAllForUser(req.user.userId, filters);

    return {
      items: result.items,
      meta: {
        total: result.total,
        limit: validatedLimit,
        offset: offset || 0,
        totalUnfiltered: (result as any).totalUnfiltered,
      },
    };
  }

  @Get('archived')
  public async findArchived(
    @Request() req: UnifiedAuthRequest,
    @Query('projectId') projectId?: string, // Make generic
  ) {
    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);

      return this.channelsService.findArchivedForProject(projectId, req.user.userId);
    }

    // For now, let's just return for user. If API token is used with scope, we should filter.
    const channels = await this.channelsService.findArchivedForUser(req.user.userId);

    if (req.user.allProjects === false && req.user.projectIds) {
      return channels.filter(c => c.projectId && req.user.projectIds?.includes(c.projectId));
    }

    return channels;
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return channel;
  }

  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return this.channelsService.update(id, req.user.userId, updateChannelDto);
  }

  @Patch(':id/template-variations/:projectTemplateId')
  public async upsertTemplateVariation(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Param('projectTemplateId') projectTemplateId: string,
    @Body() data: UpsertChannelTemplateVariationBodyDto,
  ) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return this.channelsService.upsertTemplateVariation({
      channelId: id,
      userId: req.user.userId,
      projectTemplateId,
      variation: {
        excluded: data.excluded,
        overrides: data.overrides,
      },
    });
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return this.channelsService.remove(id, req.user.userId);
  }

  /**
   * Test channel connection and credentials.
   */
  @Post(':id/test')
  public async test(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return this.socialPostingService.testChannel(id);
  }
}
