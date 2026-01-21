import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '../../generated/prisma/client.js';

import { AppConfig } from '../../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
        preferences: {},
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
    const where: Prisma.UserWhereInput = {};

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
    data: { fullName?: string; avatarUrl?: string },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
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
}
