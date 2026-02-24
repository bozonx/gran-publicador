import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { ApiTokenScopeService } from '../../common/services/api-token-scope.service.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import {
  CreateProjectDto,
  FindProjectsQueryDto,
  UpdateProjectDto,
  AddMemberDto,
  UpdateMemberDto,
  SearchNewsQueryDto,
  FetchNewsContentDto,
  TransferProjectDto,
} from './dto/index.js';
import { ProjectsService } from './projects.service.js';

/**
 * Controller for managing projects.
 * Handles creation, retrieval, updating, and deletion of projects.
 */
@Controller('projects')
@UseGuards(JwtOrApiTokenGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly apiTokenScope: ApiTokenScopeService,
  ) {}

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    // API tokens with limited scope cannot create new projects
    if (req.user.allProjects === false && req.user.projectIds && req.user.projectIds.length > 0) {
      this.logger.warn(
        `Project creation attempt blocked for limited scope API token! User: ${req.user.userId}, TokenUID: ${req.user.tokenId}`,
      );
      throw new ForbiddenException('API tokens with limited scope cannot create projects');
    }
    return this.projectsService.create(req.user.userId, createProjectDto);
  }

  @Get()
  public async findAll(@Request() req: UnifiedAuthRequest, @Query() query: FindProjectsQueryDto) {
    const projects = await this.projectsService.findAllForUser(req.user.userId, {
      search: query.search,
      includeArchived: query.includeArchived,
      limit: query.limit || undefined,
      hasContentCollections: query.hasContentCollections,
    });

    // Filter projects based on token scope
    if (req.user.allProjects === false && req.user.projectIds) {
      return projects.filter(p => req.user.projectIds!.includes(p.id));
    }

    return projects;
  }

  @Get('archived')
  public async findArchived(@Request() req: UnifiedAuthRequest) {
    const projects = await this.projectsService.findArchivedForUser(req.user.userId);

    // Filter projects based on token scope
    if (req.user.allProjects === false && req.user.projectIds) {
      return projects.filter(p => req.user.projectIds!.includes(p.id));
    }

    return projects;
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.findOne(id, req.user.userId, true);
  }

  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.update(id, req.user.userId, updateProjectDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.remove(id, req.user.userId);
  }

  @Get(':id/members')
  public async findMembers(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.findMembers(id, req.user.userId);
  }

  @Post(':id/members')
  public async addMember(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() addMemberDto: AddMemberDto,
  ) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.addMember(id, req.user.userId, addMemberDto);
  }

  @Patch(':id/members/:userId')
  public async updateMemberRole(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.updateMemberRole(
      id,
      req.user.userId,
      memberUserId,
      updateMemberDto,
    );
  }

  @Delete(':id/members/:userId')
  public async removeMember(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Param('userId') memberUserId: string,
  ) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, id);

    return this.projectsService.removeMember(id, req.user.userId, memberUserId);
  }

  @Get(':id/news/search')
  public async searchNews(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Query() query: SearchNewsQueryDto,
  ) {
    return this.projectsService.searchNews(id, req.user.userId, query);
  }

  @Post(':id/news/:newsId/content')
  public async fetchNewsContent(
    @Request() req: UnifiedAuthRequest,
    @Param('id') projectId: string,
    @Param('newsId') newsId: string,
    @Body() body: FetchNewsContentDto,
  ) {
    this.apiTokenScope.validateProjectScopeOrThrow(req, projectId);

    return this.projectsService.fetchNewsContent(projectId, req.user.userId, newsId, body);
  }

  @Post(':id/transfer')
  public async transfer(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() transferProjectDto: TransferProjectDto,
  ) {
    // API tokens with limited scope cannot transfer projects
    if (req.user.allProjects === false && req.user.projectIds && req.user.projectIds.length > 0) {
      this.logger.warn(
        `Project transfer attempt blocked for limited scope API token! User: ${req.user.userId}, TokenUID: ${req.user.tokenId}`,
      );
      throw new ForbiddenException('API tokens with limited scope cannot transfer projects');
    }

    return this.projectsService.transfer(id, req.user.userId, transferProjectDto);
  }
}
