import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { SystemRoleType } from '../../common/types/permissions.types.js';
import { CreateAuthorSignatureDto } from './dto/create-author-signature.dto.js';
import { UpdateAuthorSignatureDto } from './dto/update-author-signature.dto.js';
import { UpsertVariantDto } from './dto/upsert-variant.dto.js';

@Injectable()
export class AuthorSignaturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  private normalizeSignatureContent(value: string): string {
    return value
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * List all signatures for a project.
   * VIEWER role cannot see signatures.
   */
  async findAllByProject(projectId: string, userId: string) {
    await this.assertNotViewer(projectId, userId);

    return this.prisma.projectAuthorSignature.findMany({
      where: { projectId },
      include: {
        variants: true,
        user: { select: { id: true, fullName: true, telegramUsername: true } },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Create a new signature with the first variant in the caller's language.
   */
  async create(projectId: string, userId: string, dto: CreateAuthorSignatureDto) {
    await this.assertNotViewer(projectId, userId);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    return this.prisma.projectAuthorSignature.create({
      data: {
        projectId,
        userId,
        variants: {
          create: {
            language: dto.language || user.language,
            content: this.normalizeSignatureContent(dto.content),
          },
        },
      },
      include: {
        variants: true,
        user: { select: { id: true, fullName: true, telegramUsername: true } },
      },
    });
  }

  /**
   * Update signature metadata (order).
   */
  async update(signatureId: string, userId: string, dto: UpdateAuthorSignatureDto) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.projectAuthorSignature.update({
      where: { id: signatureId },
      data: dto,
      include: {
        variants: true,
        user: { select: { id: true, fullName: true, telegramUsername: true } },
      },
    });
  }

  /**
   * Upsert a language variant for a signature.
   */
  async upsertVariant(
    signatureId: string,
    language: string,
    userId: string,
    dto: UpsertVariantDto,
  ) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.projectAuthorSignatureVariant.upsert({
      where: { signatureId_language: { signatureId, language } },
      create: { signatureId, language, content: this.normalizeSignatureContent(dto.content) },
      update: { content: this.normalizeSignatureContent(dto.content) },
    });
  }

  /**
   * Delete a language variant.
   */
  async deleteVariant(signatureId: string, language: string, userId: string) {
    await this.assertWriteAccess(signatureId, userId);

    const variant = await this.prisma.projectAuthorSignatureVariant.findUnique({
      where: { signatureId_language: { signatureId, language } },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.projectAuthorSignatureVariant.delete({
      where: { id: variant.id },
    });
  }

  /**
   * Delete a signature and all its variants (cascade).
   */
  async delete(signatureId: string, userId: string) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.projectAuthorSignature.delete({
      where: { id: signatureId },
    });
  }

  /**
   * Resolve signature variant content by language.
   * Returns the content string or null if no variant exists for the language.
   */
  async resolveVariantContent(signatureId: string, language: string): Promise<string | null> {
    const variant = await this.prisma.projectAuthorSignatureVariant.findUnique({
      where: { signatureId_language: { signatureId, language } },
    });

    return variant?.content ?? null;
  }

  /**
   * Delete all signatures belonging to a project (used when transferring project ownership).
   */
  async deleteAllByProject(projectId: string) {
    return this.prisma.projectAuthorSignature.deleteMany({
      where: { projectId },
    });
  }

  /**
   * Check if user has write access to a signature.
   * Accessible to: signature owner, project owner, project ADMIN, system admin.
   */
  async checkAccess(signatureId: string, userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) return true;

    const signature = await this.prisma.projectAuthorSignature.findUnique({
      where: { id: signatureId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
              include: { role: true },
            },
          },
        },
      },
    });

    if (!signature) return false;
    if (signature.userId === userId) return true;
    if (signature.project.ownerId === userId) return true;

    const member = signature.project.members[0];
    return member?.role?.systemType === SystemRoleType.ADMIN;
  }

  /**
   * Assert that the user is not a VIEWER in the project.
   */
  private async assertNotViewer(projectId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    if (user?.isAdmin) return;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId },
          include: { role: true },
        },
      },
    });

    if (!project) throw new NotFoundException('Project not found');
    if (project.ownerId === userId) return;

    const member = project.members[0];

    if (!member) {
      throw new ForbiddenException('You do not have access to this project');
    }

    if (member.role?.systemType === SystemRoleType.VIEWER) {
      throw new ForbiddenException('Viewers cannot access author signatures');
    }
  }

  /**
   * Assert that the user has write access to a signature. Throws if not.
   */
  private async assertWriteAccess(signatureId: string, userId: string): Promise<void> {
    const hasAccess = await this.checkAccess(signatureId, userId);

    if (!hasAccess) {
      throw new ForbiddenException('You do not have permission to modify this signature');
    }
  }
}
