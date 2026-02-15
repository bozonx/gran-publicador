import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, Req } from '@nestjs/common';
import { NewsQueriesService } from './news-queries.service.js';
import { CreateNewsQueryDto } from './dto/create-news-query.dto.js';
import { UpdateNewsQueryDto } from './dto/update-news-query.dto.js';
import { ReorderNewsQueriesDto } from './dto/reorder-news-queries.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';

@Controller('projects/:projectId/news-queries')
@UseGuards(JwtAuthGuard)
export class NewsQueriesController {
  constructor(private readonly newsQueriesService: NewsQueriesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @Req() req: AuthenticatedRequest) {
    return this.newsQueriesService.findAll(projectId, req.user.sub);
  }

  @Patch('reorder')
  reorder(
    @Param('projectId') projectId: string,
    @Body() reorderDto: ReorderNewsQueriesDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.newsQueriesService.reorder(projectId, req.user.sub, reorderDto);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() createNewsQueryDto: CreateNewsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.newsQueriesService.create(projectId, req.user.sub, createNewsQueryDto);
  }

  @Patch(':id')
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() updateNewsQueryDto: UpdateNewsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.newsQueriesService.update(id, projectId, req.user.sub, updateNewsQueryDto);
  }

  @Delete(':id')
  remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.newsQueriesService.remove(id, projectId, req.user.sub);
  }
}
