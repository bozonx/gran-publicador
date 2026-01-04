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
import { ChannelsService } from './channels.service.js';
import { CreateChannelDto, UpdateChannelDto } from './dto/index.js';

/**
 * Controller for managing channels within projects.
 */
@Controller('channels')
@UseGuards(JwtOrApiTokenGuard)
export class ChannelsController {
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
    @Query('projectId') projectId?: string,
    @Query('isActive') isActive?: string,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived?: boolean,
    @Query('limit') limit?: number,
  ) {
    const options = {
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      allowArchived: includeArchived,
      limit: limit ? Number(limit) : undefined,
    };

    if (projectId) {
      // Validate project scope for API token users
      if (req.user.scopeProjectIds) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.scopeProjectIds, {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }

      return this.channelsService.findAllForProject(projectId, req.user.userId, options);
    }

    // If no projectId, fetch all channels for the user
    const projectIds = req.user.scopeProjectIds;

    return this.channelsService.findAllForUser(req.user.userId, { ...options, projectIds });
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
