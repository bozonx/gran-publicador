import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService } from '../../common/services/permissions.service.js';
import { SystemRoleType } from '../../common/types/permissions.types.js';
import { CreateAuthorSignatureDto } from './dto/create-author-signature.dto.js';
import { UpdateAuthorSignatureDto } from './dto/update-author-signature.dto.js';
import { UpsertVariantDto } from './dto/upsert-variant.dto.js';
import { ReorderSignaturesDto } from './dto/reorder-signatures.dto.js';
import { UpdateSignatureWithVariantsDto } from './dto/update-signature-with-variants.dto.js';

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

    return this.prisma.authorSignature.findMany({
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

    // If userId is provided in DTO, we use it (e.g. admin creating for someone else)
    const targetUserId = dto.userId || userId;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: targetUserId } });

    return this.prisma.authorSignature.create({
      data: {
        projectId,
        userId: targetUserId,
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
   * Update signature with all its variants at once.
   */
  async updateWithVariants(
    signatureId: string,
    userId: string,
    dto: UpdateSignatureWithVariantsDto,
  ) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.$transaction(async tx => {
      // Update signature metadata
      const signature = await tx.authorSignature.update({
        where: { id: signatureId },
        data: {
          order: dto.order,
        },
      });

      if (dto.variants) {
        // Sync variants: delete missing ones and upsert current ones
        const currentLangs = dto.variants.map(v => v.language);

        await tx.authorSignatureVariant.deleteMany({
          where: {
            signatureId,
            language: { notIn: currentLangs },
          },
        });

        for (const v of dto.variants) {
          await tx.authorSignatureVariant.upsert({
            where: { signatureId_language: { signatureId, language: v.language } },
            create: {
              signatureId,
              language: v.language,
              content: this.normalizeSignatureContent(v.content),
            },
            update: {
              content: this.normalizeSignatureContent(v.content),
            },
          });
        }
      }

      return tx.authorSignature.findUnique({
        where: { id: signatureId },
        include: {
          variants: true,
          user: { select: { id: true, fullName: true, telegramUsername: true } },
        },
      });
    });
  }

  /**
   * Batch update order of signatures in a project.
   */
  async reorder(projectId: string, userId: string, dto: ReorderSignaturesDto) {
    await this.assertNotViewer(projectId, userId);

    await this.prisma.$transaction(
      dto.signatureIds.map((id, index) =>
        this.prisma.authorSignature.update({
          where: { id, projectId },
          data: { order: index },
        }),
      ),
    );

    return this.findAllByProject(projectId, userId);
  }

  /**
   * Update signature metadata (order).
   */
  async update(signatureId: string, userId: string, dto: UpdateAuthorSignatureDto) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.authorSignature.update({
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

    return this.prisma.authorSignatureVariant.upsert({
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

    const variant = await this.prisma.authorSignatureVariant.findUnique({
      where: { signatureId_language: { signatureId, language } },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return this.prisma.authorSignatureVariant.delete({
      where: { id: variant.id },
    });
  }

  /**
   * Delete a signature and all its variants (cascade).
   */
  async delete(signatureId: string, userId: string) {
    await this.assertWriteAccess(signatureId, userId);

    return this.prisma.authorSignature.delete({
      where: { id: signatureId },
    });
  }

  /**
   * Resolve signature variant content by language.
   * Returns the content string or null if no variant exists for the language.
   */
  async resolveVariantContent(signatureId: string, language: string): Promise<string | null> {
    const variant = await this.prisma.authorSignatureVariant.findUnique({
      where: { signatureId_language: { signatureId, language } },
    });

    return variant?.content ?? null;
  }

  /**
   * Delete all signatures belonging to a project (used when transferring project ownership).
   */
  async deleteAllByProject(projectId: string) {
    return this.prisma.authorSignature.deleteMany({
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

    const signature = await this.prisma.authorSignature.findUnique({
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
