import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { LlmService } from './llm.service.js';
import { GenerateContentDto } from './dto/generate-content.dto.js';

/**
 * Controller for LLM content generation endpoints.
 */
@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  /**
   * Generate content using LLM.
   * POST /api/v1/llm/generate
   */
  @Post('generate')
  async generateContent(@Body() dto: GenerateContentDto) {
    const response = await this.llmService.generateContent(dto);
    return {
      content: this.llmService.extractContent(response),
      metadata: response._router,
      usage: response.usage,
    };
  }
}
