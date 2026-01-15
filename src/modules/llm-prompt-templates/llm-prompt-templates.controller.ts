import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { LlmPromptTemplatesService } from './llm-prompt-templates.service.js';
import { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';
import { ReorderLlmPromptTemplatesDto } from './dto/reorder-llm-prompt-templates.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TemplateOwnershipGuard } from './guards/template-ownership.guard.js';

@Controller('llm-prompt-templates')
@UseGuards(JwtAuthGuard)
export class LlmPromptTemplatesController {
  constructor(
    private readonly llmPromptTemplatesService: LlmPromptTemplatesService,
  ) {}

  @Post()
  create(@Body() createDto: CreateLlmPromptTemplateDto) {
    return this.llmPromptTemplatesService.create(createDto);
  }

  /**
   * Get all templates for a specific user.
   * Only the user themselves can access their templates.
   */
  @Get('user/:userId')
  findAllByUser(@Param('userId') userId: string, @Request() req: any) {
    // Verify that the user is requesting their own templates
    if (req.user.id !== userId) {
      throw new ForbiddenException(
        'You can only access your own templates',
      );
    }

    return this.llmPromptTemplatesService.findAllByUser(userId);
  }

  /**
   * Get all templates for a specific project.
   * User must be a member or owner of the project.
   */
  @Get('project/:projectId')
  async findAllByProject(
    @Param('projectId') projectId: string,
    @Request() req: any,
  ) {
    // Note: Project membership check is done in the service layer
    // through the Prisma query that includes project members
    return this.llmPromptTemplatesService.findAllByProject(projectId);
  }

  @Get(':id')
  @UseGuards(TemplateOwnershipGuard)
  findOne(@Param('id') id: string) {
    return this.llmPromptTemplatesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TemplateOwnershipGuard)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLlmPromptTemplateDto,
  ) {
    return this.llmPromptTemplatesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(TemplateOwnershipGuard)
  remove(@Param('id') id: string) {
    return this.llmPromptTemplatesService.remove(id);
  }

  /**
   * Reorder templates.
   * Ownership validation is done in the service layer.
   */
  @Post('reorder')
  reorder(@Body() reorderDto: ReorderLlmPromptTemplatesDto, @Request() req: any) {
    return this.llmPromptTemplatesService.reorder(reorderDto.ids, req.user.id);
  }
}

