import {
  Body,
  Controller,
  DefaultValuePipe,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JWT_STRATEGY } from '../../common/constants/auth.constants.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import { BanUserDto, UpdateUserAdminDto, UpdateUserProfileDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

/**
 * Controller for managing users.
 * Admin-only endpoints for user management.
 */
@Controller('users')
@UseGuards(AuthGuard(JWT_STRATEGY))
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  /**
   * Get all users with pagination and filtering.
   * Admin only.
   */
  @Get()
  public async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('is_admin') isAdmin?: string,
    @Query('search') search?: string,
  ) {
    // Check if user is admin
    const currentUser = await this.usersService.findById(req.user.sub);
    if (!currentUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    const isAdminFilter = isAdmin === 'true' ? true : isAdmin === 'false' ? false : undefined;

    return this.usersService.findAll({
      page,
      perPage,
      isAdmin: isAdminFilter,
      search,
    });
  }

  /**
   * Toggle admin status for a user.
   * Admin only.
   */
  @Patch(':id/admin')
  public async toggleAdmin(
    @Request() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() updateDto: UpdateUserAdminDto,
  ) {
    // Check if user is admin
    const currentUser = await this.usersService.findById(req.user.sub);
    if (!currentUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    // Prevent user from removing their own admin status
    if (userId === req.user.sub && !updateDto.isAdmin) {
      throw new ForbiddenException('Cannot remove your own admin status');
    }

    return this.usersService.updateAdminStatus(userId, updateDto.isAdmin);
  }

  /**
   * Update current user profile.
   */
  @Patch('me')
  public async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateDto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.sub, updateDto);
  }

  /**
   * Ban a user.
   * Admin only.
   */
  @Post(':id/ban')
  public async banUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() banDto: BanUserDto,
  ) {
    const currentUser = await this.usersService.findById(req.user.sub);
    if (!currentUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    if (userId === req.user.sub) {
      throw new ForbiddenException('Cannot ban yourself');
    }

    return this.usersService.banUser(userId, banDto.reason);
  }

  /**
   * Unban a user.
   * Admin only.
   */
  @Post(':id/unban')
  public async unbanUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') userId: string,
  ) {
    const currentUser = await this.usersService.findById(req.user.sub);
    if (!currentUser?.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return this.usersService.unbanUser(userId);
  }
}
