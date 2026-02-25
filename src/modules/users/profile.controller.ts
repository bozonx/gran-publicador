import { Body, Controller, Delete, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JWT_STRATEGY } from '../../common/constants/auth.constants.js';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.interface.js';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto.js';
import { UpdateUserProfileDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

/**
 * Controller for managing current user profile and settings.
 */
@Controller('users/me')
@UseGuards(AuthGuard(JWT_STRATEGY))
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Update current user profile.
   */
  @Patch()
  public async updateProfile(
    @Request() req: AuthenticatedRequest,
    @Body() updateDto: UpdateUserProfileDto,
  ) {
    return this.usersService.updateProfile(req.user.sub, updateDto);
  }

  /**
   * Delete current user (soft delete).
   */
  @Delete()
  public async deleteMe(@Request() req: AuthenticatedRequest) {
    return this.usersService.softDelete(req.user.sub);
  }

  /**
   * Get notification preferences for current user.
   */
  @Get('notification-preferences')
  public async getNotificationPreferences(@Request() req: AuthenticatedRequest) {
    return this.usersService.getNotificationPreferences(req.user.sub);
  }

  /**
   * Update notification preferences for current user.
   */
  @Patch('notification-preferences')
  public async updateNotificationPreferences(
    @Request() req: AuthenticatedRequest,
    @Body() preferences: NotificationPreferencesDto,
  ) {
    return this.usersService.updateNotificationPreferences(req.user.sub, preferences);
  }
}
