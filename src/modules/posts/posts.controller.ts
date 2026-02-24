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

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ApiTokenScopeService } from '../../common/services/api-token-scope.service.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ParsePostStatusPipe } from '../../common/pipes/parse-post-status.pipe.js';
import { ParsePostTypePipe } from '../../common/pipes/parse-post-type.pipe.js';
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
    private readonly apiTokenScope: ApiTokenScopeService,
  ) {}

  @Post()
  public async create(@Request() req: UnifiedAuthRequest, @Body() createPostDto: CreatePostDto) {
    const { channelId, ...data } = createPostDto;

    const channel = await this.channelsService.findOne(channelId, req.user.userId);
    this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);

    return this.postsService.create(req.user.userId, channelId, data);
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
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const filters = { status, postType, search, includeArchived, limit, offset, publicationStatus };

    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);
    } else if (channelId) {
      const channel = await this.channelsService.findOne(channelId, req.user.userId);
      this.apiTokenScope.validateProjectScopeOrThrow(req, channel.projectId);
    }

    let result: { items: any[]; total: number };

    if (projectId) {
      result = await this.postsService.findAllForProject(projectId, req.user.userId, filters);
    } else if (channelId) {
      result = await this.postsService.findAllForChannel(channelId, req.user.userId, filters);
    } else {
      // Global fetch for user
      result = await this.postsService.findAllForUser(req.user.userId, filters);
    }

    return {
      items: result.items,
      meta: {
        total: result.total,
        totalUnfiltered: (result as any).totalUnfiltered ?? result.total,
        limit,
        offset,
      },
    };
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    const projectId = post.channel?.projectId;
    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);
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

    const projectId = post.channel?.projectId;
    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);
    }

    return this.postsService.update(id, req.user.userId, updatePostDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    const projectId = post.channel?.projectId;
    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);
    }

    return this.postsService.remove(id, req.user.userId);
  }

  /**
   * Publish a single post to its channel.
   */
  @Post(':id/publish')
  public async publish(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    const post = await this.postsService.findOne(id, req.user.userId);

    const projectId = post.channel?.projectId;
    if (projectId) {
      this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);
    }

    return this.socialPostingService.enqueuePost(id, { force: true });
  }
}
