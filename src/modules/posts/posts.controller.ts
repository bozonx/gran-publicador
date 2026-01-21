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
  ParseIntPipe,
} from '@nestjs/common';

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ParsePostStatusPipe } from '../../common/pipes/parse-post-status.pipe.js';
import { ParsePostTypePipe } from '../../common/pipes/parse-post-type.pipe.js';
import { SOCIAL_MEDIA_VALIDATION_RULES } from '../../common/validators/social-media-validation.constants.js';
import { ChannelsService } from '../channels/channels.service.js';
import { SocialPostingService } from '../social-posting/social-posting.service.js';
import { CreatePostDto, UpdatePostDto } from './dto/index.js';
import { PostsService } from './posts.service.js';

/**
 * Controller for managing posts within channels.
 */
@Controller('posts')
@UseGuards(JwtOrApiTokenGuard)
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly channelsService: ChannelsService,
    private readonly socialPostingService: SocialPostingService,
  ) {}

  @Post()
  public async create(@Request() req: UnifiedAuthRequest, @Body() createPostDto: CreatePostDto) {
    const { channelId, ...data } = createPostDto;

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      const channel = await this.channelsService.findOne(channelId, req.user.userId);
      ApiTokenGuard.validateProjectScope(channel.projectId, req.user.allProjects, req.user.projectIds ?? [], {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.postsService.create(req.user.userId, channelId, data);
  }

  @Get('validation-rules')
  public getValidationRules() {
    return {
      rules: SOCIAL_MEDIA_VALIDATION_RULES,
    };
  }

  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query('channelId') channelId?: string,
    @Query('projectId') projectId?: string,
    @Query('status', new ParsePostStatusPipe()) status?: any,
    @Query('postType', new ParsePostTypePipe()) postType?: any,
    @Query('search') search?: string,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived?: boolean,
    @Query('publicationStatus') publicationStatus?: string | string[],
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
  ) {
    const filters = { status, postType, search, includeArchived, limit, page, publicationStatus };

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      if (projectId) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      } else if (channelId) {
        const channel = await this.channelsService.findOne(channelId, req.user.userId);
        ApiTokenGuard.validateProjectScope(channel.projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }
    }

    if (projectId) {
      return this.postsService.findAllForProject(projectId, req.user.userId, filters);
    }
    if (channelId) {
      return this.postsService.findAllForChannel(channelId, req.user.userId, filters);
    }

    // Global fetch for user
    return this.postsService.findAllForUser(req.user.userId, filters);
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      // @ts-ignore - post returned from findOne includes channel
      const projectId = post.channel?.projectId;
      if (projectId) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }
    }

    return post;
  }

  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const post = await this.postsService.findOne(id, req.user.userId);

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      // @ts-ignore - post returned from findOne includes channel
      const projectId = post.channel?.projectId;
      if (projectId) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }
    }

    return this.postsService.update(id, req.user.userId, updatePostDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      // @ts-ignore - post returned from findOne includes channel
      const projectId = post.channel?.projectId;
      if (projectId) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }
    }

    return this.postsService.remove(id, req.user.userId);
  }

  /**
   * Publish a single post to its channel.
   */
  @Post(':id/publish')
  public async publish(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    // Validate project scope for API token users
    if (req.user.allProjects !== undefined) {
      // @ts-ignore - post returned from findOne includes channel
      const projectId = post.channel?.projectId;
      if (projectId) {
        ApiTokenGuard.validateProjectScope(projectId, req.user.allProjects, req.user.projectIds ?? [], {
          userId: req.user.userId,
          tokenId: req.user.tokenId,
        });
      }
    }

    return this.socialPostingService.publishPost(id);
  }
}
