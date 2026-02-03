import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
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

import { AdminGuard } from '../../common/guards/admin.guard.js';
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
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get all users with pagination and filtering.
   * Admin only.
   */
  @Get()
  @UseGuards(AdminGuard)
  public async findAll(
    @Request() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('perPage', new DefaultValuePipe(20), ParseIntPipe) perPage: number,
    @Query('is_admin') isAdmin?: string,
    @Query('search') search?: string,
  ) {
    const isAdminFilter = isAdmin === 'true' ? true : isAdmin === 'false' ? false : undefined;

    return this.usersService.findAll({
      page,
      perPage,
      isAdmin: isAdminFilter,
      search,
    });
  }

  /**
   * Get a single user by ID.
   * Admin only.
   */
  @Get(':id')
  @UseGuards(AdminGuard)
  public async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  /**
   * Toggle admin status for a user.
   * Admin only.
   */
  @Patch(':id/admin')
  @UseGuards(AdminGuard)
  public async toggleAdmin(
    @Request() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() updateDto: UpdateUserAdminDto,
  ) {

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
  @UseGuards(AdminGuard)
  public async banUser(
    @Request() req: AuthenticatedRequest,
    @Param('id') userId: string,
    @Body() banDto: BanUserDto,
  ) {

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
  @UseGuards(AdminGuard)
  public async unbanUser(@Request() req: AuthenticatedRequest, @Param('id') userId: string) {
    return this.usersService.unbanUser(userId);
  }

  /**
   * Delete current user (soft delete).
   */
  @Delete('me')
  public async deleteMe(@Request() req: AuthenticatedRequest) {
    return this.usersService.softDelete(req.user.sub);
  }

  /**
   * Get notification preferences for current user.
   */
  @Get('me/notification-preferences')
  public async getNotificationPreferences(@Request() req: AuthenticatedRequest) {
    return this.usersService.getNotificationPreferences(req.user.sub);
  }

  /**
   * Update notification preferences for current user.
   */
  @Patch('me/notification-preferences')
  public async updateNotificationPreferences(
    @Request() req: AuthenticatedRequest,
    @Body() preferences: any,
  ) {
    return this.usersService.updateNotificationPreferences(req.user.sub, preferences);
  }
}
