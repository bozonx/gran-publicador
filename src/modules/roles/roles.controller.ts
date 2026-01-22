import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { CreateRoleDto } from './dto/create-role.dto.js';
import { UpdateRoleDto } from './dto/update-role.dto.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';

@Controller()
@UseGuards(JwtOrApiTokenGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('projects/:projectId/roles')
  findAll(@Param('projectId') projectId: string, @Request() req: UnifiedAuthRequest) {
    return this.rolesService.findAll(projectId, req.user.userId);
  }

  @Get('roles/:id')
  findOne(@Param('id') id: string, @Request() req: UnifiedAuthRequest) {
    return this.rolesService.findOne(id, req.user.userId);
  }

  @Post('projects/:projectId/roles')
  create(
    @Param('projectId') projectId: string,
    @Request() req: UnifiedAuthRequest,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.rolesService.create(projectId, req.user.userId, createRoleDto);
  }

  @Patch('roles/:id')
  update(
    @Param('id') id: string,
    @Request() req: UnifiedAuthRequest,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, req.user.userId, updateRoleDto);
  }

  @Delete('roles/:id')
  remove(@Param('id') id: string, @Request() req: UnifiedAuthRequest) {
    return this.rolesService.remove(id, req.user.userId);
  }
}
