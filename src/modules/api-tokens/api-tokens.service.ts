import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';

import type { AppConfig } from '../../config/app.config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ApiTokenDto,
  type CreateApiTokenDto,
  type UpdateApiTokenDto,
} from './dto/api-token.dto.js';

/**
 * Service for managing user API tokens.
 * Uses SHA-256 hashing for token lookup and AES-256-CBC encryption for storing plaintext tokens.
 */
@Injectable()
export class ApiTokensService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;
  private readonly logger = new Logger(ApiTokensService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Use JWT_SECRET as encryption key (must be 32 bytes for AES-256)
    const jwtSecret = this.configService.get<AppConfig>('app')?.jwtSecret ?? '';
    this.encryptionKey = Buffer.from(jwtSecret.padEnd(32, '0').slice(0, 32));
  }

  /**
   * Hash a plain token using SHA-256 for database lookup
   */
  private hashToken(plainToken: string): string {
    return createHash('sha256').update(plainToken).digest('hex');
  }

  /**
   * Encrypt a plain token
   */
  private encryptToken(plainToken: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Store IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt an encrypted token
   */
  private decryptToken(encryptedToken: string): string {
    try {
      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        return '[INVALID_FORMAT]';
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e: any) {
      this.logger.error(`Failed to decrypt API token: ${e.message}`);
      return '[DECRYPTION_ERROR]';
    }
  }

  /**
   * Generate a secure random token
   */
  private generateToken(): string {
    return 'gpt_' + randomBytes(32).toString('base64url');
  }

  /**
   * Create a new API token for a user
   */
  public async create(userId: string, dto: CreateApiTokenDto): Promise<ApiTokenDto> {
    // Determine if this is a full access token
    const allProjects = dto.allProjects ?? false;
    const projectIds = dto.projectIds ?? [];

    // Validate: can't have both allProjects=true and specific projectIds
    if (allProjects && projectIds.length > 0) {
      throw new ForbiddenException(
        'Cannot specify both allProjects=true and specific projectIds',
      );
    }

    // Validate project scope - ensure user is a member of all projects in scope
    if (!allProjects && projectIds.length > 0) {
      const projects = await this.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
      });

      if (projects.length !== projectIds.length) {
        const foundIds = projects.map(p => p.id);
        const missingIds = projectIds.filter(id => !foundIds.includes(id));
        this.logger.warn(
          `User ${userId} attempted to create API token with unauthorized projects: ${missingIds.join(', ')}`,
        );
        throw new ForbiddenException(
          `Insufficient permissions for projects: ${missingIds.join(', ')}`,
        );
      }
    }

    const plainToken = this.generateToken();
    const hashedToken = this.hashToken(plainToken);
    const encryptedToken = this.encryptToken(plainToken);

    try {
      const apiToken = await this.prisma.apiToken.create({
        data: {
          userId,
          name: dto.name,
          hashedToken,
          encryptedToken,
          allProjects,
          projects: {
            create: projectIds.map(projectId => ({
              projectId,
            })),
          },
        },
        include: {
          projects: {
            select: {
              projectId: true,
            },
          },
        },
      });

      return plainToInstance(
        ApiTokenDto,
        {
          ...apiToken,
          plainToken,
          projectIds: apiToken.projects.map(p => p.projectId),
        },
        { excludeExtraneousValues: true },
      );
    } catch (error: any) {
      if (error.code === 'P2002') {
        // Unique constraint violation - extremely rare but possible
        throw new ConflictException('Token generation collision. Please try again.');
      }
      throw error;
    }
  }

  /**
   * Find all API tokens for a user
   */
  public async findAllByUser(userId: string): Promise<ApiTokenDto[]> {
    const tokens = await this.prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return tokens.map(token =>
      plainToInstance(
        ApiTokenDto,
        {
          ...token,
          plainToken: this.decryptToken(token.encryptedToken),
          projectIds: token.projects.map(p => p.projectId),
        },
        { excludeExtraneousValues: true },
      ),
    );
  }

  /**
   * Update an API token (name and scope only)
   */
  public async update(id: string, userId: string, dto: UpdateApiTokenDto): Promise<ApiTokenDto> {
    const token = await this.prisma.apiToken.findUnique({
      where: { id },
      include: {
        projects: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!token) {
      throw new NotFoundException('API token not found');
    }

    if (token.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this token');
    }

    const updateData: any = {};
    
    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    // Handle allProjects flag update
    if (dto.allProjects !== undefined) {
      updateData.allProjects = dto.allProjects;
      
      // If switching to allProjects=true, remove all specific project links
      if (dto.allProjects) {
        await this.prisma.apiTokenProject.deleteMany({
          where: { apiTokenId: id },
        });
      }
    }

    // Handle projectIds update
    if (dto.projectIds !== undefined) {
      const projectIds = dto.projectIds;

      // Validate: can't have both allProjects=true and specific projectIds
      const willBeAllProjects = dto.allProjects ?? token.allProjects;
      if (willBeAllProjects && projectIds.length > 0) {
        throw new ForbiddenException(
          'Cannot specify both allProjects=true and specific projectIds',
        );
      }

      // Validate project scope
      if (projectIds.length > 0) {
        const projects = await this.prisma.project.findMany({
          where: {
            id: { in: projectIds },
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
            ],
          },
        });

        if (projects.length !== projectIds.length) {
          const foundIds = projects.map(p => p.id);
          const missingIds = projectIds.filter(id => !foundIds.includes(id));
          this.logger.warn(
            `User ${userId} attempted to update API token ${id} with unauthorized projects: ${missingIds.join(', ')}`,
          );
          throw new ForbiddenException(
            `Insufficient permissions for projects: ${missingIds.join(', ')}`,
          );
        }
      }

      // Update project relations: delete old, create new
      await this.prisma.apiTokenProject.deleteMany({
        where: { apiTokenId: id },
      });

      if (projectIds.length > 0) {
        await this.prisma.apiTokenProject.createMany({
          data: projectIds.map(projectId => ({
            apiTokenId: id,
            projectId,
          })),
        });
      }
    }

    const updated = await this.prisma.apiToken.update({
      where: { id },
      data: updateData,
      include: {
        projects: {
          select: {
            projectId: true,
          },
        },
      },
    });

    return plainToInstance(
      ApiTokenDto,
      {
        ...updated,
        plainToken: this.decryptToken(updated.encryptedToken),
        projectIds: updated.projects.map(p => p.projectId),
      },
      { excludeExtraneousValues: true },
    );
  }

  /**
   * Delete an API token
   */
  public async delete(id: string, userId: string): Promise<void> {
    const token = await this.prisma.apiToken.findUnique({
      where: { id },
    });

    if (!token) {
      throw new NotFoundException('API token not found');
    }

    if (token.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this token');
    }

    await this.prisma.apiToken.delete({
      where: { id },
    });
  }

  /**
   * Validate a token and return user info and scope
   * Used by the API authentication guard
   */
  public async validateToken(plainToken: string): Promise<{
    userId: string;
    allProjects: boolean;
    projectIds: string[];
    tokenId: string;
  } | null> {
    const hashedToken = this.hashToken(plainToken);

    const token = await this.prisma.apiToken.findUnique({
      where: { hashedToken },
      include: {
        projects: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!token) {
      return null;
    }

    return {
      userId: token.userId,
      allProjects: token.allProjects,
      projectIds: token.projects.map(p => p.projectId),
      tokenId: token.id,
    };
  }

  /**
   * Update last used timestamp for a token
   * Called asynchronously after successful authentication
   */
  public async updateLastUsed(tokenId: string): Promise<void> {
    await this.prisma.apiToken.update({
      where: { id: tokenId },
      data: { lastUsedAt: new Date() },
    });
  }
}
