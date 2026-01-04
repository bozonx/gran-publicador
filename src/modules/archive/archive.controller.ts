import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_STRATEGY } from '../../common/constants/auth.constants.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import { ArchiveService } from './archive.service.js';
import { ArchiveEntityType, MoveEntityDto } from './dto/archive.dto.js';

@Controller('archive')
@UseGuards(AuthGuard(JWT_STRATEGY))
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) { }

  @Post(':type/:id')
  public archive(
    @Request() req: AuthenticatedRequest,
    @Param('type') type: ArchiveEntityType,
    @Param('id') id: string,
  ) {
    return this.archiveService.archiveEntity(type, id, req.user.sub);
  }

  @Post(':type/:id/restore')
  public restore(
    @Request() req: AuthenticatedRequest,
    @Param('type') type: ArchiveEntityType,
    @Param('id') id: string
  ) {
    return this.archiveService.restoreEntity(type, id, req.user.sub);
  }

  @Delete(':type/:id')
  public remove(
    @Request() req: AuthenticatedRequest,
    @Param('type') type: ArchiveEntityType,
    @Param('id') id: string
  ) {
    return this.archiveService.deleteEntityPermanently(type, id, req.user.sub);
  }

  @Post(':type/:id/move')
  public move(
    @Param('type') type: ArchiveEntityType,
    @Param('id') id: string,
    @Body() moveDto: MoveEntityDto,
  ) {
    return this.archiveService.moveEntity(type, id, moveDto.targetParentId);
  }

  @Get('stats')
  public getStats() {
    return this.archiveService.getArchiveStats();
  }

  @Get(':type')
  public findAll(@Param('type') type: ArchiveEntityType) {
    return this.archiveService.getArchivedEntities(type);
  }
}
