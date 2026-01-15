import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { LlmPromptTemplatesService } from './llm-prompt-templates.service.js';
import { CreateLlmPromptTemplateDto } from './dto/create-llm-prompt-template.dto.js';
import { UpdateLlmPromptTemplateDto } from './dto/update-llm-prompt-template.dto.js';
import { ReorderLlmPromptTemplatesDto } from './dto/reorder-llm-prompt-templates.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

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

  @Get('user/:userId')
  findAllByUser(@Param('userId') userId: string) {
    return this.llmPromptTemplatesService.findAllByUser(userId);
  }

  @Get('project/:projectId')
  findAllByProject(@Param('projectId') projectId: string) {
    return this.llmPromptTemplatesService.findAllByProject(projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.llmPromptTemplatesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateLlmPromptTemplateDto,
  ) {
    return this.llmPromptTemplatesService.update(id, updateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.llmPromptTemplatesService.remove(id);
  }

  @Post('reorder')
  reorder(@Body() reorderDto: ReorderLlmPromptTemplatesDto) {
    return this.llmPromptTemplatesService.reorder(reorderDto.ids);
  }
}
