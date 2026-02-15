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
import { PublicationStatus, SocialMedia } from '../../generated/prisma/index.js';

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ParsePublicationStatusPipe } from '../../common/pipes/parse-publication-status.pipe.js';
import type { PaginatedResponse } from '../../common/dto/pagination-response.dto.js';
import {
  CreatePostsDto,
  CreatePublicationDto,
  UpdatePublicationDto,
  FindPublicationsQueryDto,
  PublicationSortBy,
  SortOrder,
  OwnershipType,
  IssueType,
  ReorderMediaDto,
  BulkOperationDto,
  PublicationLlmChatDto,
} from './dto/index.js';
import { PublicationsService } from './publications.service.js';
import { SocialPostingService } from '../social-posting/social-posting.service.js';

/**
 * Controller for managing publications (content that can be distributed to multiple channels).
 */
@Controller('publications')
@UseGuards(JwtOrApiTokenGuard)
export class PublicationsController {
  private readonly MAX_LIMIT = 1000;

  constructor(
    private readonly publicationsService: PublicationsService,
    private readonly socialPostingService: SocialPostingService,
  ) {}

  /**
   * Create a new publication.
   */
  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createPublicationDto: CreatePublicationDto,
  ) {
    // Validate project scope for API token users if projectId is provided
    if (createPublicationDto.projectId && req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(
        createPublicationDto.projectId,
        req.user.allProjects,
        req.user.projectIds,
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }
    return this.publicationsService.create(createPublicationDto, req.user.userId);
  }

  /**
   * Get all publications for a project or user with filtering and sorting.
   */
  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query() query: FindPublicationsQueryDto,
  ): Promise<PaginatedResponse<any>> {
    const {
      projectId,
      status,
      limit = 20,
      offset = 0,
      includeArchived = false,
      archivedOnly = false,
      sortBy,
      sortOrder,
      channelId,
      search,
      language,
      ownership,
      socialMedia,
      issueType,
      tags,
    } = query;

    // Validate and cap limit
    const validatedLimit = Math.min(limit, this.MAX_LIMIT);

    const filters = {
      status,
      limit: validatedLimit,
      offset,
      includeArchived,
      archivedOnly,
      sortBy,
      sortOrder,
      channelId,
      search,
      language,
      ownership,
      socialMedia,
      issueType,
      tags,
    };

    if (projectId) {
      const result = await this.publicationsService.findAll(projectId, req.user.userId, filters);
      return {
        items: result.items,
        meta: {
          total: result.total,
          totalUnfiltered: result.totalUnfiltered,
          limit: validatedLimit,
          offset: offset || 0,
        },
      };
    }

    const result = await this.publicationsService.findAllForUser(req.user.userId, filters);
    return {
      items: result.items,
      meta: {
        total: result.total,
        totalUnfiltered: result.totalUnfiltered,
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
   * Chat with LLM for a publication.
   * POST /api/v1/publications/:id/llm/chat
   */
  @Post(':id/llm/chat')
  public async llmChat(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: PublicationLlmChatDto,
  ) {
    const controller = new AbortController();
    const rawReq: any = (req as any).raw ?? (req as any).req ?? req;

    rawReq?.on?.('aborted', () => {
      controller.abort();
    });
    rawReq?.on?.('close', () => {
      controller.abort();
    });

    return this.publicationsService.chatWithLlm(id, req.user.userId, dto, {
      signal: controller.signal,
    });
  }

  /**
   * Delete a publication.
   */
  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.publicationsService.remove(id, req.user.userId);
  }

  /**
   * Perform bulk operations on publications.
   */
  @Post('bulk')
  public async bulkOperation(
    @Request() req: UnifiedAuthRequest,
    @Body() bulkOperationDto: BulkOperationDto,
  ) {
    return this.publicationsService.bulkOperation(req.user.userId, bulkOperationDto);
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
    if (publication.projectId && req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(
        publication.projectId,
        req.user.allProjects,
        req.user.projectIds,
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }

    return this.publicationsService.createPostsFromPublication(
      id,
      createPostsDto.channelIds,
      req.user.userId,
      createPostsDto.scheduledAt,
      createPostsDto.authorSignatureId,
      createPostsDto.authorSignatureOverrides,
    );
  }

  /**
   * Add media files to a publication.
   */
  @Post(':id/media')
  public async addMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() body: { media: any[] },
  ) {
    return this.publicationsService.addMedia(id, req.user.userId, body.media);
  }

  /**
   * Remove a media file from a publication.
   */
  @Delete(':id/media/:mediaId')
  public async removeMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.publicationsService.removeMedia(id, req.user.userId, mediaId);
  }

  /**
   * Reorder media files in a publication.
   */
  @Patch(':id/media/reorder')
  public async reorderMedia(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() body: ReorderMediaDto,
  ) {
    return this.publicationsService.reorderMedia(id, req.user.userId, body.media);
  }

  /**
   * Update a media link (properties like hasSpoiler) in a publication.
   */
  @Patch(':id/media/:mediaLinkId')
  public async updateMediaLink(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Param('mediaLinkId') mediaLinkId: string,
    @Body() body: { hasSpoiler?: boolean; order?: number },
  ) {
    return this.publicationsService.updateMediaLink(id, req.user.userId, mediaLinkId, body);
  }

  /**
   * Publish all posts of a publication to their respective channels.
   */
  @Post(':id/publish')
  public async publish(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Query('force', new DefaultValuePipe(false), ParseBoolPipe) force: boolean,
  ) {
    // Validate project scope for API token users
    const publication = await this.publicationsService.findOne(id, req.user.userId);
    if (publication.projectId && req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(
        publication.projectId,
        req.user.allProjects,
        req.user.projectIds,
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }

    return this.socialPostingService.publishPublication(id, { force });
  }

  /**
   * Copy a publication to another project.
   */
  @Post(':id/copy')
  public async copy(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() body: { projectId: string },
  ) {
    // Validate project scope for API token users
    if (body.projectId && req.user.allProjects === false && req.user.projectIds) {
      ApiTokenGuard.validateProjectScope(
        body.projectId,
        req.user.allProjects,
        req.user.projectIds,
        {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        },
      );
    }

    return this.publicationsService.copy(id, body.projectId, req.user.userId);
  }
}
