import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '../../generated/prisma/index.js';

import { AppConfig } from '../../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  NotificationPreferencesDto,
  getDefaultNotificationPreferences,
} from './dto/notification-preferences.dto.js';

/**
 * Service for managing user data.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Normalize language code for content/data.
   * If it's a known short code, normalize it to full code.
   * Otherwise, keep as is (to support all content languages).
   */
  private normalizeLanguage(code?: string | null): string {
    if (!code) return 'en-US';
    const low = code.toLowerCase();
    if (low === 'ru' || low.startsWith('ru-')) return 'ru-RU';
    if (low === 'en') return 'en-US';
    if (low === 'en-gb') return 'en-GB';
    if (low.startsWith('en-')) return 'en-US';
    if (low === 'es' || low.startsWith('es-')) return 'es-ES';
    if (low === 'de' || low.startsWith('de-')) return 'de-DE';
    if (low === 'fr' || low.startsWith('fr-')) return 'fr-FR';
    // Add more if needed, otherwise return as is
    return code;
  }

  /**
   * Normalize language code for User Interface.
   * Only supports languages that have translations.
   */
  private normalizeUiLanguage(code?: string | null): string {
    if (!code) return 'en-US';
    const low = code.toLowerCase();
    if (low.startsWith('ru')) return 'ru-RU';
    return 'en-US'; // Default fallback for interface
  }

  public async findByTelegramId(telegramId: bigint): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { telegramId },
    });
  }

  public async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find a user by their Telegram ID or create one if they don't exist.
   * Updates profile information (username, name, avatar) on every login.
   *
   * @param userData - The user data from Telegram.
   * @returns The existing or newly created User.
   */
  public async findOrCreateTelegramUser(userData: {
    telegramId: bigint;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    languageCode?: string;
  }): Promise<User> {
    const constructedName = [userData.firstName, userData.lastName].filter(Boolean).join(' ');
    let fullName: string | null = constructedName !== '' ? constructedName : null;

    // Fallback to username if no full name can be constructed
    if (!fullName && userData.username) {
      fullName = userData.username;
    }

    // Check if this user should be an admin based on environment variable
    const adminId = this.configService.get<AppConfig>('app')?.adminTelegramId;
    let isAdmin = false;
    if (adminId && /^\d+$/.test(adminId)) {
      try {
        isAdmin = BigInt(adminId) === userData.telegramId;
      } catch (e) {
        this.logger.warn(`Failed to convert adminTelegramId "${adminId}" to BigInt: ${e}`);
      }
    }

    return this.prisma.user.upsert({
      where: { telegramId: userData.telegramId },
      update: {
        telegramUsername: userData.username,
        fullName: fullName,
        avatarUrl: userData.avatarUrl,
      },
      create: {
        telegramId: userData.telegramId,
        telegramUsername: userData.username,
        fullName: fullName,
        avatarUrl: userData.avatarUrl,
        isAdmin: isAdmin,
        language: this.normalizeLanguage(userData.languageCode),
        uiLanguage: this.normalizeUiLanguage(userData.languageCode),
        preferences: JSON.parse(
          JSON.stringify({
            notifications: getDefaultNotificationPreferences(),
          }),
        ),
      },
    });
  }


  /**
   * Find all users with pagination and filtering.
   * Returns users with their statistics (projects count, posts count).
   */
  public async findAll(options: {
    page: number;
    perPage: number;
    isAdmin?: boolean;
    search?: string;
  }) {
    const { page, perPage, isAdmin, search } = options;
    const skip = (page - 1) * perPage;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (isAdmin !== undefined) {
      where.isAdmin = isAdmin;
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { telegramUsername: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const total = await this.prisma.user.count({ where });

    // Get users with statistics
    const users = await this.prisma.user.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            ownedProjects: true,
            publications: true,
          },
        },
      },
    });

    // Transform users to match UserDto and include statistics
    const data = users.map(user => ({
      id: user.id,
      fullName: user.fullName,
      telegramUsername: user.telegramUsername,
      avatarUrl: user.avatarUrl,
      telegramId: user.telegramId?.toString(),
      isAdmin: user.isAdmin,
      isBanned: user.isBanned,
      banReason: user.banReason,
      language: user.language,
      uiLanguage: user.uiLanguage,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      projectsCount: user._count.ownedProjects,
      publicationsCount: user._count.publications,
    }));

    return {
      data,
      meta: {
        total,
        page,
        perPage,
      },
    };
  }

  /**
   * Update admin status for a user.
   */
  public async updateAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });
  }

  /**
   * Update user profile data.
   */
  public async updateProfile(
    userId: string,
    data: { 
      fullName?: string; 
      avatarUrl?: string; 
      language?: string; 
      uiLanguage?: string;
      isUiLanguageAuto?: boolean;
      projectOrder?: string[];
    },
  ): Promise<User> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.language !== undefined) updateData.language = this.normalizeLanguage(data.language);
    if (data.uiLanguage !== undefined) updateData.uiLanguage = this.normalizeUiLanguage(data.uiLanguage);

    if (data.isUiLanguageAuto !== undefined || data.projectOrder !== undefined) {
      // Get current preferences to merge
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const currentPreferences = (user?.preferences as any) || {};

      const newPreferences = { ...currentPreferences };
      if (data.isUiLanguageAuto !== undefined) newPreferences.isUiLanguageAuto = data.isUiLanguageAuto;
      if (data.projectOrder !== undefined) newPreferences.projectOrder = data.projectOrder;

      updateData.preferences = JSON.parse(JSON.stringify(newPreferences));
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Ban a user.
   */
  public async banUser(userId: string, reason?: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: reason,
      },
    });
  }

  /**
   * Unban a user.
   */
  public async unbanUser(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
      },
    });
  }
  /**
   * Update user's hashed refresh token.
   *
   * @param userId - The user's ID.
   * @param hashedRefreshToken - The new hashed token or null to remove it.
   */
  public async updateHashedRefreshToken(
    userId: string,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hashedRefreshToken },
    });
  }
  /**
   * Soft-delete a user.
   * Marks the user as deleted, clears the refresh token, and deletes all API tokens.
   */
  public async softDelete(userId: string): Promise<void> {
    await this.prisma.$transaction([
      // Mark user as deleted and clear refresh token
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          hashedRefreshToken: null,
        },
      }),
      // Delete all API tokens associated with the user
      this.prisma.apiToken.deleteMany({
        where: { userId },
      }),
    ]);
  }

  /**
   * Get notification preferences for a user.
   * Returns default preferences if not set.
   */
  public async getNotificationPreferences(userId: string): Promise<NotificationPreferencesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const preferences = user.preferences as any;
    
    // Return existing preferences or defaults
    if (preferences?.notifications && typeof preferences.notifications === 'object') {
      return preferences.notifications as NotificationPreferencesDto;
    }

    return getDefaultNotificationPreferences();
  }

  /**
   * Update notification preferences for a user.
   */
  public async updateNotificationPreferences(
    userId: string,
    notificationPreferences: NotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentPreferences = (user.preferences as any) || {};

    // Update user preferences with new notification settings
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        preferences: JSON.parse(
          JSON.stringify({
            ...currentPreferences,
            notifications: notificationPreferences,
          }),
        ),
      },
    });

    return notificationPreferences;
  }
}
