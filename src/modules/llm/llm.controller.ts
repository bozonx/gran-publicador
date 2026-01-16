import { Body, Controller, Post, UseGuards, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { LlmService } from './llm.service.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';

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
      // If parsing fails, we could return raw content in one of the fields but better to throw error or return empty
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
