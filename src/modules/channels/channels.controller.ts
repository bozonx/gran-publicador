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

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import type { PaginatedResponse } from '../../common/dto/pagination-response.dto.js';
import { ChannelsService } from './channels.service.js';
import {
  CreateChannelDto,
  UpdateChannelDto,
  FindChannelsQueryDto,
  ChannelResponseDto,
} from './dto/index.js';
import { SocialPostingService } from '../social-posting/social-posting.service.js';

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
  ) {}

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createChannelDto: CreateChannelDto,
  ) {
    const { projectId, ...data } = createChannelDto;

    // Validate project scope for API token users
    // Validate project scope for API token users
    this.validateProjectScope(req, projectId);

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
      // Validate project scope for API token users
      // Validate project scope for API token users
      this.validateProjectScope(req, projectId);

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
      // Validate project scope for API token users
      // Validate project scope for API token users
      this.validateProjectScope(req, projectId);

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

    // Validate project scope for API token users
    // Validate project scope for API token users
    this.validateProjectScope(req, channel.projectId);

    return channel;
  }

  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    // Validate project scope for API token users
    // Validate project scope for API token users
    this.validateProjectScope(req, channel.projectId);

    return this.channelsService.update(id, req.user.userId, updateChannelDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    // Validate project scope for API token users
    // Validate project scope for API token users
    this.validateProjectScope(req, channel.projectId);

    return this.channelsService.remove(id, req.user.userId);
  }

  /**
   * Test channel connection and credentials.
   */
  @Post(':id/test')
  public async test(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    // Validate project scope for API token users
    // Validate project scope for API token users
    this.validateProjectScope(req, channel.projectId);

    return this.socialPostingService.testChannel(id);
  }
  /**
   * Helper to validate project scope for API token users.
   */
  private validateProjectScope(req: UnifiedAuthRequest, projectId: string) {
    if (req.user.allProjects !== undefined) {
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
