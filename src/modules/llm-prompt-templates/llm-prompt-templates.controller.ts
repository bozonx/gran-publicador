import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Query,
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
import { SetAvailableLlmPromptTemplatesOrderDto } from './dto/set-available-llm-prompt-templates-order.dto.js';
import { AvailableLlmPromptTemplatesQueryDto } from './dto/available-llm-prompt-templates-query.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TemplateOwnershipGuard } from './guards/template-ownership.guard.js';

@Controller('llm-prompt-templates')
@UseGuards(JwtAuthGuard)
export class LlmPromptTemplatesController {
  constructor(private readonly llmPromptTemplatesService: LlmPromptTemplatesService) {}

  // ─── Aggregated available templates ─────────────────────────────────

  @Get('available')
  getAvailable(@Query() query: AvailableLlmPromptTemplatesQueryDto, @Request() req: any) {
    return this.llmPromptTemplatesService.getAvailableTemplatesForUser({
      userId: req.user.id,
      projectId: query.projectId,
    });
  }

  // ─── System templates ───────────────────────────────────────────────

  @Get('system')
  getSystem(@Query('includeHidden') includeHidden: string, @Request() req: any) {
    return this.llmPromptTemplatesService.getSystemTemplates(req.user.id, includeHidden === 'true');
  }

  @Post('system/:systemId/hide')
  hideSystem(@Param('systemId') systemId: string, @Request() req: any) {
    return this.llmPromptTemplatesService.hideSystemTemplate(req.user.id, systemId);
  }

  @Post('system/:systemId/unhide')
  unhideSystem(@Param('systemId') systemId: string, @Request() req: any) {
    return this.llmPromptTemplatesService.unhideSystemTemplate(req.user.id, systemId);
  }

  // ─── Copy target projects ──────────────────────────────────────────

  @Get('copy-targets')
  getCopyTargets(@Request() req: any) {
    return this.llmPromptTemplatesService.getCopyTargetProjects(req.user.id);
  }

  // ─── CRUD ──────────────────────────────────────────────────────────

  @Post()
  create(@Body() createDto: CreateLlmPromptTemplateDto) {
    return this.llmPromptTemplatesService.create(createDto);
  }

  @Get('user/:userId')
  findAllByUser(
    @Param('userId') userId: string,
    @Query('includeHidden') includeHidden: string,
    @Request() req: any,
  ) {
    if (req.user.id !== userId) {
      throw new ForbiddenException('You can only access your own templates');
    }

    return this.llmPromptTemplatesService.findAllByUser(userId, includeHidden === 'true');
  }

  @Get('project/:projectId')
  async findAllByProject(
    @Param('projectId') projectId: string,
    @Query('includeHidden') includeHidden: string,
    @Request() req: any,
  ) {
    return this.llmPromptTemplatesService.findAllByProject(projectId, includeHidden === 'true');
  }

  @Get(':id')
  @UseGuards(TemplateOwnershipGuard)
  findOne(@Param('id') id: string) {
    return this.llmPromptTemplatesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(TemplateOwnershipGuard)
  update(@Param('id') id: string, @Body() updateDto: UpdateLlmPromptTemplateDto) {
    return this.llmPromptTemplatesService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(TemplateOwnershipGuard)
  remove(@Param('id') id: string) {
    return this.llmPromptTemplatesService.remove(id);
  }

  // ─── Hide / Unhide ─────────────────────────────────────────────────

  @Post(':id/hide')
  @UseGuards(TemplateOwnershipGuard)
  hide(@Param('id') id: string) {
    return this.llmPromptTemplatesService.hideTemplate(id);
  }

  @Post(':id/unhide')
  @UseGuards(TemplateOwnershipGuard)
  unhide(@Param('id') id: string) {
    return this.llmPromptTemplatesService.unhideTemplate(id);
  }

  // ─── Reorder ───────────────────────────────────────────────────────

  @Post('reorder')
  reorder(@Body() reorderDto: ReorderLlmPromptTemplatesDto, @Request() req: any) {
    return this.llmPromptTemplatesService.reorder(reorderDto.ids, req.user.id);
  }

  @Post('available/order')
  setAvailableOrder(@Body() dto: SetAvailableLlmPromptTemplatesOrderDto, @Request() req: any) {
    return this.llmPromptTemplatesService.setAvailableOrder({
      userId: req.user.id,
      projectId: dto.projectId,
      ids: dto.ids,
    });
  }
}
