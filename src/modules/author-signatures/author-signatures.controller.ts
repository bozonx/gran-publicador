import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthorSignaturesService } from './author-signatures.service.js';
import { CreateAuthorSignatureDto } from './dto/create-author-signature.dto.js';
import { UpdateAuthorSignatureDto } from './dto/update-author-signature.dto.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import { SignatureAccessGuard } from './guards/signature-access.guard.js';

@Controller('author-signatures')
@UseGuards(JwtOrApiTokenGuard)
export class AuthorSignaturesController {
  constructor(private readonly authorSignaturesService: AuthorSignaturesService) {}

  @Post()
  create(@Body() createDto: CreateAuthorSignatureDto, @Request() req: any) {
    return this.authorSignaturesService.create(req.user.id, createDto);
  }

  @Get('user/:userId')
  findAllByUser(
    @Request() req: any,
    @Param('userId') userId: string,
    @Query('channelId') channelId?: string,
  ) {
    // Basic verification: user can only see their own signatures unless they are admin/owner (handled in service)
    // For now, simple check:
    if (req.user.id !== userId && !req.user.isAdmin) {
        // FindAllByChannel should be used for project-wide visibility
        throw new Error('Unauthorized access to user signatures');
    }
    return this.authorSignaturesService.findAllByUser(userId, channelId);
  }

  @Get('channel/:channelId')
  findAllByChannel(@Param('channelId') channelId: string, @Request() req: any) {
    return this.authorSignaturesService.findAllByChannel(channelId, req.user.id);
  }

  @Get('presets')
  getPresets() {
    return this.authorSignaturesService.getPresets();
  }

  @Get(':id')
  @UseGuards(SignatureAccessGuard)
  findOne(@Param('id') id: string) {
    return this.authorSignaturesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SignatureAccessGuard)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAuthorSignatureDto,
    @Request() req: any,
  ) {
    return this.authorSignaturesService.update(id, req.user.id, updateDto);
  }

  @Patch(':id/set-default')
  @UseGuards(SignatureAccessGuard)
  setDefault(@Param('id') id: string, @Request() req: any) {
    return this.authorSignaturesService.setDefault(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(SignatureAccessGuard)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.authorSignaturesService.archive(id, req.user.id);
  }

  @Post(':id/restore')
  @UseGuards(SignatureAccessGuard)
  restore(@Param('id') id: string, @Request() req: any) {
    return this.authorSignaturesService.restore(id, req.user.id);
  }
}
