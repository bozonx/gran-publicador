import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import type { PaginatedResponse } from '../../common/dto/pagination-response.dto.js';
import { ChannelsService } from './channels.service.js';
import { CreateChannelDto, UpdateChannelDto, FindChannelsQueryDto } from './dto/index.js';

/**
 * Controller for managing channels within projects.
 */
@Controller('channels')
@UseGuards(JwtOrApiTokenGuard)
export class ChannelsController {
  private readonly MAX_LIMIT = 100;

  constructor(private readonly channelsService: ChannelsService) { }

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createChannelDto: CreateChannelDto,
  ) {
    const { projectId, ...data } = createChannelDto;

    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.channelsService.create(req.user.userId, projectId, data);
  }

  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindChannelsQueryDto,
  ): Promise<PaginatedResponse<any>> {
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
      projectIds: req.user.scopeProjectIds,
    };

    if (projectId) {
      // Validate project scope for API token users
      if (req.user.scopeProjectIds) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.scopeProjectIds, {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }

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
      if (req.user.scopeProjectIds) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.scopeProjectIds, {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }

      return this.channelsService.findArchivedForProject(projectId, req.user.userId);
    }

    // For now, let's just return for user. If API token is used with scope, we should filter.
    const channels = await this.channelsService.findArchivedForUser(req.user.userId);

    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      return channels.filter(c =>
        (c as any).projectId && req.user.scopeProjectIds!.includes((c as any).projectId)
      );
    }

    return channels;
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(channel.projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

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
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(channel.projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.channelsService.update(id, req.user.userId, updateChannelDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const channel = await this.channelsService.findOne(id, req.user.userId, true);

    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(channel.projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.channelsService.remove(id, req.user.userId);
  }


}
