import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { NewsQueriesService } from './news-queries.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

@Controller('news-queries')
@UseGuards(JwtAuthGuard)
export class GlobalNewsQueriesController {
  constructor(private readonly newsQueriesService: NewsQueriesService) {}

  @Get('default')
  findAllDefault(@Req() req: any) {
    return this.newsQueriesService.findAllDefault(req.user.id);
  }
}
