import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Request,
} from '@nestjs/common';

import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { PublicationRelationsService } from './publication-relations.service.js';
import { LinkPublicationDto } from './dto/link-publication.dto.js';
import { UnlinkPublicationDto } from './dto/unlink-publication.dto.js';
import { ReorderGroupDto } from './dto/reorder-group.dto.js';
import { CreateRelatedPublicationDto } from './dto/create-related-publication.dto.js';

/**
 * Controller for managing publication relation groups (SERIES, LOCALIZATION).
 */
@Controller('publications')
@UseGuards(JwtOrApiTokenGuard)
export class PublicationRelationsController {
  constructor(private readonly relationsService: PublicationRelationsService) {}

  /**
   * Get all relation groups for a publication.
   */
  @Get(':id/relations')
  public async getRelations(@Request() req: UnifiedAuthRequest, @Param('id') id: string) {
    return this.relationsService.getRelations(id, req.user.userId);
  }

  /**
   * Link a publication to another via a relation group.
   */
  @Post(':id/relations/link')
  public async link(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: LinkPublicationDto,
  ) {
    return this.relationsService.link(id, req.user.userId, dto);
  }

  /**
   * Unlink a publication from a relation group.
   */
  @Post(':id/relations/unlink')
  public async unlink(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: UnlinkPublicationDto,
  ) {
    return this.relationsService.unlink(id, req.user.userId, dto);
  }

  /**
   * Create a new publication based on the current one and link them.
   */
  @Post(':id/relations/create-related')
  public async createRelated(
    @Request() req: UnifiedAuthRequest,
    @Param('id') id: string,
    @Body() dto: CreateRelatedPublicationDto,
  ) {
    return this.relationsService.createRelated(id, req.user.userId, dto);
  }

  /**
   * Reorder publications within a relation group.
   */
  @Patch('relation-groups/:groupId/reorder')
  public async reorder(
    @Request() req: UnifiedAuthRequest,
    @Param('groupId') groupId: string,
    @Body() dto: ReorderGroupDto,
  ) {
    return this.relationsService.reorder(groupId, req.user.userId, dto);
  }
}
