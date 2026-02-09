import { Body, Controller, Post, UseGuards, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(LlmController.name);

  constructor(private readonly llmService: LlmService) {}

  /**
   * Extract publication parameters using LLM.
   * POST /api/v1/llm/extract-parameters
   * @deprecated Use generate-publication-fields instead.
   */
  @Post('extract-parameters')
  async extractParameters(@Body() dto: GenerateContentDto) {
    const response = await this.llmService.extractParameters(dto);
    const content = this.llmService.extractContent(response);

    // Try to parse JSON from content
    let parsed: any = {};
    try {
      // Remove possible markdown code blocks
      const cleanJson = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    } catch (e: any) {
      this.logger.error(`Failed to parse LLM JSON response: ${e.message}`);
    }

    return {
      title: parsed.title || '',
      description: parsed.description || '',
      tags: parsed.tags || '',
      content: parsed.content || '',
      metadata: response._router,
      usage: response.usage,
    };
  }

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
