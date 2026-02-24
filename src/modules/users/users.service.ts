import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '../../generated/prisma/index.js';

import { AppConfig } from '../../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { normalizeLocale } from '../../common/utils/locale.util.js';
import {
  NotificationPreferencesDto,
  getDefaultNotificationPreferences,
} from './dto/notification-preferences.dto.js';

type UserWithFlags = User & { isSuperAdmin: boolean };

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

  private normalizeLanguage(code?: string | null): string {
    return normalizeLocale(code, { defaultLocale: 'en-US' });
  }

  private normalizeUiLanguage(code?: string | null): string {
    const normalized = normalizeLocale(code, { defaultLocale: 'en-US' });
    return normalized.startsWith('ru-') ? 'ru-RU' : 'en-US';
  }

  public async findByTelegramId(telegramId: bigint): Promise<UserWithFlags | null> {
    const user = await this.prisma.user.findUnique({
      where: { telegramId },
    });

    return this.attachDerivedFlags(user);
  }

  /**
   * Find a single user by ID with statistics.
   */
  public async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            ownedProjects: true,
            publications: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
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
      preferences: user.preferences,
      isSuperAdmin: this.isSuperAdminByTelegramId(user.telegramId),
    };
  }

  public async findById(id: string): Promise<UserWithFlags | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return this.attachDerivedFlags(user);
  }

  /**
   * Permanently delete a user and all related data.
   */
  public async deletePermanently(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  /**
   * Force logout a user by deleting all their sessions.
   */
  public async logoutUser(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
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
  }): Promise<UserWithFlags> {
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

    const user = await (this.prisma.user as any).upsert({
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
        contentCollections: {
          create: {
            type: 'SAVED_VIEW',
            title: 'All items',
            order: 0,
            config: {
              persistSearch: true,
              persistTags: true,
            },
          },
        },
      },
    });

    return this.attachDerivedFlags(user);
  }

  /**
   * Soft-delete a user.
   * Marks the user as deleted, clears all sessions, and deletes all API tokens.
   */
  public async softDelete(userId: string): Promise<void> {
    await this.prisma.$transaction([
      // Mark user as deleted
      this.prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
        },
      }),
      // Delete all sessions
      this.prisma.userSession.deleteMany({
        where: { userId },
      }),
      // Delete all API tokens associated with the user
      this.prisma.apiToken.deleteMany({
        where: { userId },
      }),
    ]);
  }

  /**
   * Find all users with pagination and filtering.
   * Returns users with their statistics (projects count, posts count).
   */
  public async findAll(options: {
    limit: number;
    offset: number;
    isAdmin?: boolean;
    search?: string;
  }) {
    const { limit, offset, isAdmin, search } = options;
    const skip = Math.max(0, offset);
    const take = Math.max(0, limit);

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
      take,
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
      isSuperAdmin: this.isSuperAdminByTelegramId(user.telegramId),
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
        limit: take,
        offset: skip,
      },
    };
  }

  /**
   * Update admin status for a user.
   */
  public async updateAdminStatus(userId: string, isAdmin: boolean): Promise<UserWithFlags> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });

    return this.attachDerivedFlags(user)!;
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
      newsQueryOrder?: string[];
      contentLibraryCollectionOrder?: any;
      videoAutoplay?: boolean;
    },
  ): Promise<UserWithFlags> {
    const updateData: Prisma.UserUpdateInput = {};

    if (data.fullName !== undefined) updateData.fullName = data.fullName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;
    if (data.language !== undefined) updateData.language = this.normalizeLanguage(data.language);
    if (data.uiLanguage !== undefined)
      updateData.uiLanguage = this.normalizeUiLanguage(data.uiLanguage);

    if (
      data.isUiLanguageAuto !== undefined ||
      data.projectOrder !== undefined ||
      data.newsQueryOrder !== undefined ||
      data.contentLibraryCollectionOrder !== undefined ||
      data.videoAutoplay !== undefined
    ) {
      // Get current preferences to merge
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true },
      });
      const currentPreferences = (user?.preferences as any) || {};

      const newPreferences = { ...currentPreferences };
      if (data.isUiLanguageAuto !== undefined)
        newPreferences.isUiLanguageAuto = data.isUiLanguageAuto;
      if (data.projectOrder !== undefined) newPreferences.projectOrder = data.projectOrder;
      if (data.newsQueryOrder !== undefined) newPreferences.newsQueryOrder = data.newsQueryOrder;
      if (data.contentLibraryCollectionOrder !== undefined)
        newPreferences.contentLibraryCollectionOrder = data.contentLibraryCollectionOrder;
      if (data.videoAutoplay !== undefined) newPreferences.videoAutoplay = data.videoAutoplay;

      updateData.preferences = JSON.parse(JSON.stringify(newPreferences));
    }

    if ('version' in data && typeof data.version === 'number') {
      updateData.version = { increment: 1 };
      const { count } = await this.prisma.user.updateMany({
        where: { id: userId, version: data.version },
        data: updateData,
      });
      if (count === 0) {
        throw new ConflictException(
          'Данные пользователя были изменены в другой вкладке. Обновите страницу.',
        );
      }
      const updatedUser = await this.prisma.user.findUnique({ where: { id: userId } });
      return this.attachDerivedFlags(updatedUser)!;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.attachDerivedFlags(user)!;
  }

  /**
   * Ban a user.
   */
  public async banUser(userId: string, reason?: string): Promise<UserWithFlags> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        banReason: reason,
      },
    });

    return this.attachDerivedFlags(user)!;
  }

  /**
   * Unban a user.
   */
  public async unbanUser(userId: string): Promise<UserWithFlags> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        banReason: null,
      },
    });

    return this.attachDerivedFlags(user)!;
  }

  private getAdminTelegramId(): string | undefined {
    return this.configService.get<AppConfig>('app')?.adminTelegramId;
  }

  private isSuperAdminByTelegramId(telegramId?: bigint | string | null): boolean {
    const adminId = this.getAdminTelegramId();
    if (!adminId) {
      return false;
    }

    if (telegramId === null || telegramId === undefined) {
      return false;
    }

    const normalized = typeof telegramId === 'bigint' ? telegramId.toString() : String(telegramId);
    return normalized === adminId;
  }

  private attachDerivedFlags<T extends { telegramId?: bigint | string | null }>(
    user: T | null,
  ): (T & { isSuperAdmin: boolean }) | null {
    if (!user) {
      return null;
    }

    const isSuperAdmin = this.isSuperAdminByTelegramId(user.telegramId);
    return {
      ...user,
      isSuperAdmin,
    };
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
