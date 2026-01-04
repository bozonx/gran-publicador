import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { PublicationStatus } from '../../generated/prisma/client.js';

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ParsePublicationStatusPipe } from '../../common/pipes/parse-publication-status.pipe.js';
import type { PaginatedResponse } from '../../common/dto/pagination-response.dto.js';
import { CreatePostsDto, CreatePublicationDto, UpdatePublicationDto } from './dto/index.js';
import { PublicationsService } from './publications.service.js';

/**
 * Controller for managing publications (content that can be distributed to multiple channels).
 */
@Controller('publications')
@UseGuards(JwtOrApiTokenGuard)
export class PublicationsController {
  private readonly MAX_LIMIT = 100;

  constructor(private readonly publicationsService: PublicationsService) { }

  /**
   * Create a new publication.
   */
  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createPublicationDto: CreatePublicationDto,
  ) {
    // Validate project scope for API token users
    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      ApiTokenGuard.validateProjectScope(createPublicationDto.projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }
    return this.publicationsService.create(createPublicationDto, req.user.userId);
  }

  /**
   * Get all publications for a project.
   */
  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query('projectId') projectId?: string,
    @Query('status', new ParsePublicationStatusPipe()) status?: PublicationStatus,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived?: boolean,
  ): Promise<PaginatedResponse<any>> {
    // Validate and cap limit
    const validatedLimit = Math.min(limit || 50, this.MAX_LIMIT);

    if (projectId) {
      const result = await this.publicationsService.findAll(projectId, req.user.userId, {
        status,
        limit: validatedLimit,
        offset,
        includeArchived,
      });
      return {
        items: result.items,
        meta: {
          total: result.total,
          limit: validatedLimit,
          offset: offset || 0,
        },
      };
    }

    const result = await this.publicationsService.findAllForUser(req.user.userId, {
      status,
      limit: validatedLimit,
      offset,
      includeArchived,
    });
    return {
      items: result.items,
      meta: {
        total: result.total,
        limit: validatedLimit,
        offset: offset || 0,
      },
    };
  }

  /**
   * Get a single publication by ID.
   */
  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.publicationsService.findOne(id, req.user.userId);
  }

  /**
   * Update a publication.
   */
  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updatePublicationDto: UpdatePublicationDto,
  ) {
    return this.publicationsService.update(id, req.user.userId, updatePublicationDto);
  }

  /**
   * Delete a publication.
   */
  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.publicationsService.remove(id, req.user.userId);
  }

  /**
   * Generate individual posts for specified channels from a publication.
   */
  @Post(':id/posts')
  public async createPosts(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() createPostsDto: CreatePostsDto,
  ) {
    // Validate project scope for API token users
    const publication = await this.publicationsService.findOne(id, req.user.userId);
    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      ApiTokenGuard.validateProjectScope(publication.projectId, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.publicationsService.createPostsFromPublication(
      id,
      createPostsDto.channelIds,
      req.user.userId,
      createPostsDto.scheduledAt,
    );
  }
}
