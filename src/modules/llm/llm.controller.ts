import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { LlmService } from './llm.service.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';
import { GeneratePublicationFieldsDto } from './dto/generate-publication-fields.dto.js';

/**
 * Controller for LLM content generation endpoints.
 */
@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  /**
   * Generate publication fields and per-channel post fields using LLM.
   * POST /api/v1/llm/generate-publication-fields
   */
  @Post('generate-publication-fields')
  async generatePublicationFields(@Body() dto: GeneratePublicationFieldsDto) {
    const response = await this.llmService.generatePublicationFields(dto);
    const parsed = this.llmService.parsePublicationFieldsResponse(response);

    return {
      ...parsed,
      metadata: response._router,
      usage: response.usage,
    };
  }

  /**
   * Generate content using LLM.
   * POST /api/v1/llm/generate
   */
  @Post('generate')
  async generate(@Body() dto: GenerateContentDto) {
    const response = await this.llmService.generateContent(dto);

    return {
      content: this.llmService.extractContent(response),
      metadata: response._router,
      usage: response.usage,
    };
  }
}
