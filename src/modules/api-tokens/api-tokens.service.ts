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
   * Safely parse scopeProjectIds from JSON string
   */
  private parseScopeProjectIds(scopeString: string): string[] {
    try {
      const parsed = JSON.parse(scopeString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv(this.algorithm, this.encryptionKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
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
    // Validate project scope - ensure user is a member of all projects in scope
    if (dto.scopeProjectIds && dto.scopeProjectIds.length > 0) {
      const memberRecords = await this.prisma.projectMember.findMany({
        where: {
          userId,
          projectId: { in: dto.scopeProjectIds },
        },
      });

      if (memberRecords.length !== dto.scopeProjectIds.length) {
        const foundIds = memberRecords.map(r => r.projectId);
        const missingIds = dto.scopeProjectIds.filter(id => !foundIds.includes(id));
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

    const scopeProjectIds = JSON.stringify(dto.scopeProjectIds ?? []);

    try {
      const apiToken = await this.prisma.apiToken.create({
        data: {
          userId,
          name: dto.name,
          hashedToken,
          encryptedToken,
          scopeProjectIds,
        },
      });

      return plainToInstance(ApiTokenDto, {
        ...apiToken,
        plainToken,
      });
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
    });

    return tokens.map(token =>
      plainToInstance(ApiTokenDto, {
        ...token,
        plainToken: this.decryptToken(token.encryptedToken),
      }),
    );
  }

  /**
   * Update an API token (name and scope only)
   */
  public async update(id: string, userId: string, dto: UpdateApiTokenDto): Promise<ApiTokenDto> {
    const token = await this.prisma.apiToken.findUnique({
      where: { id },
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
    if (dto.scopeProjectIds !== undefined) {
      // Validate project scope
      if (dto.scopeProjectIds.length > 0) {
        const memberRecords = await this.prisma.projectMember.findMany({
          where: {
            userId,
            projectId: { in: dto.scopeProjectIds },
          },
        });

        if (memberRecords.length !== dto.scopeProjectIds.length) {
          const foundIds = memberRecords.map(r => r.projectId);
          const missingIds = dto.scopeProjectIds.filter(id => !foundIds.includes(id));
          this.logger.warn(
            `User ${userId} attempted to update API token ${id} with unauthorized projects: ${missingIds.join(', ')}`,
          );
          throw new ForbiddenException(
            `Insufficient permissions for projects: ${missingIds.join(', ')}`,
          );
        }
      }
      updateData.scopeProjectIds = JSON.stringify(dto.scopeProjectIds);
    }

    const updated = await this.prisma.apiToken.update({
      where: { id },
      data: updateData,
    });

    return plainToInstance(ApiTokenDto, {
      ...updated,
      plainToken: this.decryptToken(updated.encryptedToken),
    });
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
    scopeProjectIds: string[];
    tokenId: string;
  } | null> {
    const hashedToken = this.hashToken(plainToken);

    const token = await this.prisma.apiToken.findUnique({
      where: { hashedToken },
    });

    if (!token) {
      return null;
    }

    return {
      userId: token.userId,
      scopeProjectIds: this.parseScopeProjectIds(token.scopeProjectIds),
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
