import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAuthorSignatureDto } from './dto/create-author-signature.dto.js';
import { UpdateAuthorSignatureDto } from './dto/update-author-signature.dto.js';
import { PRESET_SIGNATURES, PresetSignature } from './constants/preset-signatures.constants.js';

@Injectable()
export class AuthorSignaturesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAuthorSignatureDto) {
    // Verify channel access
    await this.verifyChannelAccess(dto.channelId, userId);

    if (dto.isDefault) {
      // Unset other defaults for this user and channel
      await this.prisma.authorSignature.updateMany({
        where: { userId, channelId: dto.channelId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.authorSignature.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAllByUser(userId: string, channelId?: string) {
    return this.prisma.authorSignature.findMany({
      where: {
        userId,
        channelId,
      },
      orderBy: { order: 'asc' },
    });
  }

  async findAllByChannel(channelId: string, currentUserId: string) {
    // We need to find all signatures for the channel that the current user has access to.
    // According to the plan: signatures are visible to the creator, project admin, and project owner.
    
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        project: {
          include: {
            members: {
              where: { userId: currentUserId },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const isProjectOwner = channel.project.ownerId === currentUserId;
    const projectMember = channel.project.members[0];
    const isProjectAdmin = projectMember?.role === 'ADMIN';

    if (isProjectOwner || isProjectAdmin) {
      // Project owner and admin see all signatures
      return this.prisma.authorSignature.findMany({
        where: { channelId },
        orderBy: [{ userId: 'asc' }, { order: 'asc' }],
      });
    }

    // Regular members only see their own signatures
    return this.prisma.authorSignature.findMany({
      where: { channelId, userId: currentUserId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const signature = await this.prisma.authorSignature.findUnique({
      where: { id },
    });

    if (!signature) {
      throw new NotFoundException('Signature not found');
    }

    return signature;
  }

  async update(id: string, userId: string, dto: UpdateAuthorSignatureDto) {
    const signature = await this.findOne(id);

    if (signature.userId !== userId) {
      throw new ForbiddenException('You can only update your own signatures');
    }

    if (dto.isDefault) {
      // Unset other defaults for this user and channel
      await this.prisma.authorSignature.updateMany({
        where: { userId, channelId: signature.channelId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.authorSignature.update({
      where: { id },
      data: dto,
    });
  }

  async setDefault(id: string, userId: string) {
    const signature = await this.findOne(id);

    if (signature.userId !== userId) {
      throw new ForbiddenException('You can only set your own signatures as default');
    }

    // Unset other defaults
    await this.prisma.authorSignature.updateMany({
      where: { userId, channelId: signature.channelId, isDefault: true },
      data: { isDefault: false },
    });

    return this.prisma.authorSignature.update({
      where: { id },
      data: { isDefault: true },
    });
  }

  async delete(id: string, userId: string) {
    const signature = await this.findOne(id);

    if (signature.userId !== userId) {
      throw new ForbiddenException('You can only delete your own signatures');
    }

    return this.prisma.authorSignature.delete({
      where: { id },
    });
  }

  getPresets(): PresetSignature[] {
    return PRESET_SIGNATURES;
  }

  async findDefault(userId: string, channelId: string) {
    return this.prisma.authorSignature.findFirst({
      where: { userId, channelId, isDefault: true },
    });
  }

  /**
   * Checks if user has access to the signature.
   * Signature is accessible to the creator, project owner, or project admin.
   */
  async checkAccess(signatureId: string, userId: string): Promise<boolean> {
    const signature = await this.prisma.authorSignature.findUnique({
      where: { id: signatureId },
      include: {
        channel: {
          include: {
            project: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!signature) {
      return false;
    }

    if (signature.userId === userId) {
      return true;
    }

    const isProjectOwner = signature.channel.project.ownerId === userId;
    const projectMember = signature.channel.project.members[0];
    const isProjectAdmin = projectMember?.role === 'ADMIN';

    return isProjectOwner || isProjectAdmin;
  }

  private async verifyChannelAccess(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const isProjectOwner = channel.project.ownerId === userId;
    const isMember = channel.project.members.length > 0;

    if (!isProjectOwner && !isMember) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }
}
