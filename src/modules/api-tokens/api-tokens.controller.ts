import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import { ApiTokensService } from './api-tokens.service.js';
import { CreateApiTokenDto, UpdateApiTokenDto } from './dto/api-token.dto.js';

/**
 * Controller for managing user API tokens.
 * All endpoints require JWT authentication.
 */
@Controller('api-tokens')
@UseGuards(JwtAuthGuard)
export class ApiTokensController {
  constructor(private readonly apiTokensService: ApiTokensService) {}

  /**
   * Get all API tokens for the current user
   * GET /api/v1/api-tokens
   */
  @Get()
  public async findAll(@Request() req: AuthenticatedRequest) {
    return this.apiTokensService.findAllByUser(req.user.sub);
  }

  /**
   * Create a new API token
   * POST /api/v1/api-tokens
   */
  @Post()
  public async create(@Request() req: AuthenticatedRequest, @Body() dto: CreateApiTokenDto) {
    return this.apiTokensService.create(req.user.sub, dto);
  }

  /**
   * Update an API token (name and scope only)
   * PATCH /api/v1/api-tokens/:id
   */
  @Patch(':id')
  public async update(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApiTokenDto,
  ) {
    return this.apiTokensService.update(id, req.user.sub, dto);
  }

  /**
   * Delete an API token
   * DELETE /api/v1/api-tokens/:id
   */
  @Delete(':id')
  public async delete(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.apiTokensService.delete(id, req.user.sub);
    return { success: true };
  }
}
