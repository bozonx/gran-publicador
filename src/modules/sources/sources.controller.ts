import { Controller, Get, Logger, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';
import { NewsConfig } from '../../config/news.config.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@Controller('sources')
@UseGuards(JwtAuthGuard)
export class SourcesController {
  private readonly logger = new Logger(SourcesController.name);

  constructor(private readonly configService: ConfigService) {}

  @Get()
  async findAll(@Query() query: any) {
    const config = this.configService.get<NewsConfig>('news')!;
    let baseUrl = config.serviceUrl.replace(/\/$/, '');

    // Ensure we don't duplicate /api/v1 if it's already in the config
    if (!baseUrl.endsWith('/api/v1')) {
      baseUrl = `${baseUrl}/api/v1`;
    }

    const url = `${baseUrl}/sources`;

    try {
      const response = await request(url, {
        method: 'GET',
        query,
      });

      if (response.statusCode >= 400) {
        const errorText = await response.body.text();
        this.logger.error(`News microservice returned ${response.statusCode}: ${errorText}`);
        throw new Error(`News microservice error: ${response.statusCode}`);
      }

      return response.body.json();
    } catch (error: any) {
      this.logger.error(`Failed to fetch sources: ${error.message}`);
      throw error;
    }
  }
}
