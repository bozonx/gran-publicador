import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TranslateService } from './translate.service.js';
import { TranslateTextDto } from './dto/translate-text.dto.js';

/**
 * Controller for translation endpoints.
 */
@Controller('translate')
@UseGuards(JwtAuthGuard)
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {}

  /**
   * Translate text using Translate Gateway microservice.
   * POST /api/v1/translate
   */
  @Post()
  async translateText(@Body() dto: TranslateTextDto) {
    return this.translateService.translateText(dto);
  }
}
