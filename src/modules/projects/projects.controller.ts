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

import { ApiTokenGuard } from '../../common/guards/api-token.guard.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { CreateProjectDto, UpdateProjectDto } from './dto/index.js';
import { ProjectsService } from './projects.service.js';

/**
 * Controller for managing projects.
 * Handles creation, retrieval, updating, and deletion of projects.
 */
@Controller('projects')
@UseGuards(JwtOrApiTokenGuard)
export class ProjectsController {
  private readonly logger = new Logger(ProjectsController.name);

  constructor(private readonly projectsService: ProjectsService) { }

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Body() createProjectDto: CreateProjectDto,
  ) {
    // API tokens with limited scope cannot create new projects
    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      this.logger.warn(
        `Project creation attempt blocked for limited scope API token! User: ${req.user.userId}, TokenUID: ${req.user.tokenId}`,
      );
      throw new ForbiddenException('API tokens with limited scope cannot create projects');
    }
    return this.projectsService.create(req.user.userId, createProjectDto);
  }

  @Get()
  public async findAll(
    @Request() req: UnifiedAuthRequest,
    @Query('includeArchived', new DefaultValuePipe(false), ParseBoolPipe) includeArchived?: boolean,
  ) {
    const projects = await this.projectsService.findAllForUser(req.user.userId, {
      includeArchived
    });

    // Filter projects based on token scope
    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      return projects.filter(p => req.user.scopeProjectIds!.includes(p.id));
    }

    return projects;
  }

  @Get('archived')
  public async findArchived(
    @Request() req: UnifiedAuthRequest,
  ) {
    const projects = await this.projectsService.findArchivedForUser(req.user.userId);

    // Filter projects based on token scope
    if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
      return projects.filter(p => req.user.scopeProjectIds!.includes(p.id));
    }

    return projects;
  }

  @Get(':id')
  public async findOne(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(id, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.projectsService.findOne(id, req.user.userId, true);
  }

  @Patch(':id')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(id, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.projectsService.update(id, req.user.userId, updateProjectDto);
  }

  @Delete(':id')
  public async remove(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    // Validate project scope for API token users
    if (req.user.scopeProjectIds) {
      ApiTokenGuard.validateProjectScope(id, req.user.scopeProjectIds, {
        userId: req.user.userId,
        tokenId: req.user.tokenId,
      });
    }

    return this.projectsService.remove(id, req.user.userId);
  }


}
