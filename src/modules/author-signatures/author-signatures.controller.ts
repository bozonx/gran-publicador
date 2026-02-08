import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthorSignaturesService } from './author-signatures.service.js';
import { CreateAuthorSignatureDto } from './dto/create-author-signature.dto.js';
import { UpdateAuthorSignatureDto } from './dto/update-author-signature.dto.js';
import { UpsertVariantDto } from './dto/upsert-variant.dto.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { SignatureAccessGuard } from './guards/signature-access.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

@Controller()
@UseGuards(JwtOrApiTokenGuard)
export class AuthorSignaturesController {
  constructor(private readonly authorSignaturesService: AuthorSignaturesService) {}

  @Get('projects/:projectId/author-signatures')
  findAllByProject(@Param('projectId') projectId: string, @Request() req: UnifiedAuthRequest) {
    return this.authorSignaturesService.findAllByProject(projectId, req.user.id);
  }

  @Post('projects/:projectId/author-signatures')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateAuthorSignatureDto,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.create(projectId, req.user.id, dto);
  }

  @Patch('author-signatures/:id')
  @UseGuards(SignatureAccessGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAuthorSignatureDto,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.update(id, req.user.id, dto);
  }

  @Put('author-signatures/:id/variants/:language')
  @UseGuards(SignatureAccessGuard)
  upsertVariant(
    @Param('id') id: string,
    @Param('language') language: string,
    @Body() dto: UpsertVariantDto,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.upsertVariant(id, language, req.user.id, dto);
  }

  @Delete('author-signatures/:id/variants/:language')
  @UseGuards(SignatureAccessGuard)
  deleteVariant(
    @Param('id') id: string,
    @Param('language') language: string,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.deleteVariant(id, language, req.user.id);
  }

  @Delete('author-signatures/:id')
  @UseGuards(SignatureAccessGuard)
  remove(@Param('id') id: string, @Request() req: UnifiedAuthRequest) {
    return this.authorSignaturesService.delete(id, req.user.id);
  }
}
