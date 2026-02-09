import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { ProjectTemplatesService } from './project-templates.service.js';
import { CreateProjectTemplateDto } from './dto/create-project-template.dto.js';
import { UpdateProjectTemplateDto } from './dto/update-project-template.dto.js';
import { ReorderProjectTemplatesDto } from './dto/reorder-project-templates.dto.js';

/**
 * Controller for managing project-level publication templates.
 */
@Controller('projects/:projectId/templates')
@UseGuards(JwtOrApiTokenGuard)
export class ProjectTemplatesController {
  constructor(private readonly templatesService: ProjectTemplatesService) {}

  @Get()
  public async findAll(@Request() req: UnifiedAuthRequest, @Param('projectId') projectId: string) {
    return this.templatesService.findAll(projectId, req.user.userId);
  }

  @Get(':templateId')
  public async findOne(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templatesService.findOne(projectId, templateId, req.user.userId);
  }

  @Post()
  public async create(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
    @Body() data: CreateProjectTemplateDto,
  ) {
    return this.templatesService.create(projectId, req.user.userId, data);
  }

  @Patch('reorder')
  public async reorder(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
    @Body() data: ReorderProjectTemplatesDto,
  ) {
    return this.templatesService.reorder(projectId, req.user.userId, data);
  }

  @Patch(':templateId')
  public async update(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
    @Param('templateId') templateId: string,
    @Body() data: UpdateProjectTemplateDto,
  ) {
    return this.templatesService.update(projectId, templateId, req.user.userId, data);
  }

  @Delete(':templateId')
  public async remove(
    @Request() req: UnifiedAuthRequest,
    @Param('projectId') projectId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templatesService.remove(projectId, templateId, req.user.userId);
  }
}
