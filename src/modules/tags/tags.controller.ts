import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { TagsService } from './tags.service.js';
import { SearchTagsQueryDto } from './dto/index.js';

@Controller('tags')
@UseGuards(JwtOrApiTokenGuard)
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get('search')
  public async search(@Query() query: SearchTagsQueryDto) {
    return this.tagsService.search(query);
  }
}
