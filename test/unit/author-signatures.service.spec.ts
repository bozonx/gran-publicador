import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { AuthorSignaturesService } from '../../src/modules/author-signatures/author-signatures.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { SystemRoleType } from '../../src/common/types/permissions.types.js';

describe('AuthorSignaturesService (unit)', () => {
  let service: AuthorSignaturesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    authorSignature: {
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    authorSignatureVariant: {
      findUnique: jest.fn() as any,
      upsert: jest.fn() as any,
      delete: jest.fn() as any,
      deleteMany: jest.fn() as any,
    },
    user: {
      findUnique: jest.fn() as any,
      findUniqueOrThrow: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
    },
    $transaction: jest.fn((args: any) => {
      if (Array.isArray(args)) return Promise.all(args);
      if (typeof args === 'function') return args(mockPrismaService);
      return args;
    }) as any,
  };

  const mockPermissionsService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorSignaturesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    }).compile();

    service = module.get<AuthorSignaturesService>(AuthorSignaturesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAllByProject', () => {
    it('should return signatures if user is not a viewer', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
      });
      mockPrismaService.authorSignature.findMany.mockResolvedValue([{ id: 's1' }]);

      const result = await service.findAllByProject(projectId, userId);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.authorSignature.findMany).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is a viewer', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other',
        members: [{ userId, role: { systemType: SystemRoleType.VIEWER } }],
      });

      await expect(service.findAllByProject(projectId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should create signature with variant', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const dto = { content: 'Best regards,\nIvan', language: 'ru' };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      mockPrismaService.user.findUniqueOrThrow.mockResolvedValue({ language: 'en' });
      mockPrismaService.authorSignature.create.mockResolvedValue({ id: 's1' });

      await service.create(projectId, userId, dto);

      expect(mockPrismaService.authorSignature.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variants: {
              create: {
                language: 'ru',
                content: 'Best regards, Ivan', // Normalization check
              },
            },
          }),
        }),
      );
    });
  });

  describe('updateWithVariants', () => {
    it('should update signature and variants in transaction', async () => {
      const signatureId = 's1';
      const userId = 'u1';
      const dto = {
        order: 1,
        variants: [
          { language: 'ru', content: 'С уважением' },
          { language: 'en', content: 'Regards' },
        ],
      };

      // Mocking checkAccess
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      mockPrismaService.authorSignature.update.mockResolvedValue({ id: signatureId });
      mockPrismaService.authorSignature.findUnique.mockResolvedValue({ id: signatureId });

      await service.updateWithVariants(signatureId, userId, dto);

      expect(mockPrismaService.authorSignature.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { order: 1 } }),
      );
      expect(mockPrismaService.authorSignatureVariant.deleteMany).toHaveBeenCalled();
      expect(mockPrismaService.authorSignatureVariant.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('reorder', () => {
    it('should update orders in transaction', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const dto = { signatureIds: ['s1', 's2'] };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      mockPrismaService.authorSignature.update.mockResolvedValue({});

      await service.reorder(projectId, userId, dto);

      expect(mockPrismaService.authorSignature.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('should update signature order', async () => {
      const signatureId = 's1';
      const userId = 'u1';
      const dto = { order: 5 };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      mockPrismaService.authorSignature.update.mockResolvedValue({ id: signatureId, ...dto });

      const result = await service.update(signatureId, userId, dto);

      expect(result.order).toBe(5);
    });
  });

  describe('variants management', () => {
    it('should upsert variant', async () => {
      const signatureId = 's1';
      const userId = 'u1';
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      
      await service.upsertVariant(signatureId, 'ru', userId, { content: 'Test' });

      expect(mockPrismaService.authorSignatureVariant.upsert).toHaveBeenCalled();
    });

    it('should delete variant', async () => {
      const signatureId = 's1';
      const userId = 'u1';
      mockPrismaService.user.findUnique.mockResolvedValue({ id: userId, isAdmin: true });
      mockPrismaService.authorSignatureVariant.findUnique.mockResolvedValue({ id: 'v1' });

      await service.deleteVariant(signatureId, 'ru', userId);

      expect(mockPrismaService.authorSignatureVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    });

    it('should throw NotFoundException if variant to delete not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
      mockPrismaService.authorSignatureVariant.findUnique.mockResolvedValue(null);
      await expect(service.deleteVariant('s1', 'ru', 'u1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete signature', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
      await service.delete('s1', 'u1');
      expect(mockPrismaService.authorSignature.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    });
  });

  describe('deleteAllByProject', () => {
    it('should delete all signatures for project', async () => {
      await service.deleteAllByProject('p1');
      expect(mockPrismaService.authorSignature.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1' } });
    });
  });

  describe('checkAccess', () => {
    it('should allow admin access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
      const result = await service.checkAccess('s1', 'admin');
      expect(result).toBe(true);
    });

    it('should allow owner access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.authorSignature.findUnique.mockResolvedValue({ userId: 'u1' });
      const result = await service.checkAccess('s1', 'u1');
      expect(result).toBe(true);
    });

    it('should allow project admin access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.authorSignature.findUnique.mockResolvedValue({
        userId: 'other',
        project: {
          ownerId: 'another',
          members: [{ userId: 'u1', role: { systemType: SystemRoleType.ADMIN } }],
        },
      });
      const result = await service.checkAccess('s1', 'u1');
      expect(result).toBe(true);
    });

    it('should deny project viewer access', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.authorSignature.findUnique.mockResolvedValue({
        userId: 'other',
        project: {
          ownerId: 'another',
          members: [{ userId: 'u1', role: { systemType: SystemRoleType.VIEWER } }],
        },
      });
      const result = await service.checkAccess('s1', 'u1');
      expect(result).toBe(false);
    });
  });

  describe('resolveVariantContent', () => {
    it('should return variant content', async () => {
      mockPrismaService.authorSignatureVariant.findUnique.mockResolvedValue({ content: 'test' });
      const result = await service.resolveVariantContent('s1', 'en');
      expect(result).toBe('test');
    });

    it('should return null if variant not found', async () => {
      mockPrismaService.authorSignatureVariant.findUnique.mockResolvedValue(null);
      const result = await service.resolveVariantContent('s1', 'en');
      expect(result).toBeNull();
    });
  });
});
