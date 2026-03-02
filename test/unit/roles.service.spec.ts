import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { SystemRoleType } from '../../src/common/types/permissions.types.js';

describe('RolesService (unit)', () => {
  let service: RolesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    role: {
      createMany: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      findFirst: jest.fn() as any,
      create: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
      delete: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
    },
    projectMember: {
      count: jest.fn() as any,
    },
    $transaction: jest.fn((args: any) => (Array.isArray(args) ? Promise.all(args) : args)) as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createDefaultRoles', () => {
    it('should create all system roles', async () => {
      await service.createDefaultRoles('p1');
      expect(mockPrismaService.role.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ systemType: SystemRoleType.ADMIN, isSystem: true }),
        ]),
      });
    });
  });

  describe('findAll', () => {
    it('should return roles for project owner', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: userId, members: [] });
      mockPrismaService.role.findMany.mockResolvedValue([{ id: 'r1', name: 'Admin', permissions: {} }]);

      const result = await service.findAll(projectId, userId);

      expect(result).toHaveLength(1);
    });

    it('should throw ForbiddenException if user has no access', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'other', members: [] });
      await expect(service.findAll('p1', 'u1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('should allow owner to create custom role', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: userId });
      mockPrismaService.role.findFirst.mockResolvedValue(null);
      mockPrismaService.role.create.mockResolvedValue({ id: 'r1', name: 'Custom' });

      const result = await service.create(projectId, userId, { name: 'Custom', permissions: {} });

      expect(result.name).toBe('Custom');
    });

    it('should throw BadRequestException if role name exists', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: 'p1', ownerId: 'u1' });
      mockPrismaService.role.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.create('p1', 'u1', { name: 'Admin', permissions: {} })).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should remove custom role if not assigned', async () => {
      const roleId = 'r1';
      const userId = 'u1';
      const mockRole = {
        id: roleId,
        isSystem: false,
        name: 'Custom',
        projectId: 'p1',
        project: { ownerId: userId, members: [] }
      };
      
      mockPrismaService.role.findUnique.mockResolvedValue(mockRole);
      mockPrismaService.projectMember.count.mockResolvedValue(0);

      await service.remove(roleId, userId);

      expect(mockPrismaService.role.delete).toHaveBeenCalledWith({ where: { id: roleId } });
    });

    it('should throw BadRequestException for system roles', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'r1',
        isSystem: true,
        project: { ownerId: 'u1', members: [] }
      });
      await expect(service.remove('r1', 'u1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if role is assigned to members', async () => {
      mockPrismaService.role.findUnique.mockResolvedValue({
        id: 'r1',
        isSystem: false,
        project: { ownerId: 'u1', members: [] }
      });
      mockPrismaService.projectMember.count.mockResolvedValue(5);
      await expect(service.remove('r1', 'u1')).rejects.toThrow(BadRequestException);
    });
  });
});
