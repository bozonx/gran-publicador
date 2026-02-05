import {
  Controller,
  ForbiddenException,
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
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { UsersService } from '../users/users.service.js';

@Controller('author-signatures')
@UseGuards(JwtOrApiTokenGuard)
export class AuthorSignaturesController {
  constructor(
    private readonly authorSignaturesService: AuthorSignaturesService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  create(@Body() createDto: CreateAuthorSignatureDto, @Request() req: UnifiedAuthRequest) {
    return this.authorSignaturesService.create(req.user.id, createDto);
  }

  @Get('user/:userId')
  public async findAllByUser(
    @Request() req: UnifiedAuthRequest,
    @Param('userId') userId: string,
    @Query('channelId') channelId?: string,
  ) {
    // User can only see their own signatures unless they are admin
    if (req.user.id !== userId) {
      const currentUser = await this.usersService.findById(req.user.id);
      if (!currentUser?.isAdmin) {
        throw new ForbiddenException('Unauthorized access to user signatures');
      }
    }
    return this.authorSignaturesService.findAllByUser(userId, channelId);
  }

  @Get('channel/:channelId')
  public async findAllByChannel(
    @Param('channelId') channelId: string,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.findAllByChannel(channelId, req.user.id);
  }

  @Get(':id')
  @UseGuards(SignatureAccessGuard)
  public async findOne(@Param('id') id: string) {
    return this.authorSignaturesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(SignatureAccessGuard)
  public async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAuthorSignatureDto,
    @Request() req: UnifiedAuthRequest,
  ) {
    return this.authorSignaturesService.update(id, req.user.id, updateDto);
  }

  @Patch(':id/set-default')
  @UseGuards(SignatureAccessGuard)
  public async setDefault(@Param('id') id: string, @Request() req: UnifiedAuthRequest) {
    return this.authorSignaturesService.setDefault(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(SignatureAccessGuard)
  public async remove(@Param('id') id: string, @Request() req: UnifiedAuthRequest) {
    return this.authorSignaturesService.delete(id, req.user.id);
  }
}
