import { Test, type TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { PermissionKey } from '../../src/common/types/permissions.types.js';

describe('PermissionsService (unit)', () => {
  let service: PermissionsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn() as any,
    },
    user: {
      findUnique: jest.fn() as any,
    },
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = moduleRef.get<PermissionsService>(PermissionsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const projectId = 'project-1';
  const userId = 'user-1';

  describe('checkProjectAccess', () => {
    it('should grant access if user is global admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });

      // Should verify it returns early without querying project
      await expect(service.checkProjectAccess(projectId, userId)).resolves.not.toThrow();
      expect(mockPrismaService.project.findUnique).not.toHaveBeenCalled();
    });

    it('should grant access if user is owner', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
        archivedAt: null,
      });

      await expect(service.checkProjectAccess(projectId, userId)).resolves.not.toThrow();
    });

    it('should grant access if user is a member', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other-owner',
        members: [{ id: 'member-1' }],
        archivedAt: null,
      });

      await expect(service.checkProjectAccess(projectId, userId)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if project is archived and allowArchived is false', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
        archivedAt: new Date(),
      });

      await expect(service.checkProjectAccess(projectId, userId, false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is neither owner nor member', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other-owner',
        members: [],
        archivedAt: null,
      });

      await expect(service.checkProjectAccess(projectId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('checkPermission', () => {
    const permKey = PermissionKey.CHANNELS_CREATE; // channels.create

    it('should grant if user is global admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
      // Uses getFullPermissions internally
      await expect(service.checkPermission(projectId, userId, permKey)).resolves.not.toThrow();
    });

    it('should grant if user is owner (full permissions)', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
      });

      await expect(service.checkPermission(projectId, userId, permKey)).resolves.not.toThrow();
    });

    it('should grant if user has specific permission in role', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other',
        members: [
          {
            role: {
              permissions: {
                channels: { create: true },
              },
            },
          },
        ],
      });

      await expect(service.checkPermission(projectId, userId, permKey)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if user lacks specific permission', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other',
        members: [
          {
            role: {
              permissions: {
                channels: { create: false },
              },
            },
          },
        ],
      });

      await expect(service.checkPermission(projectId, userId, permKey)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for mutation on archived project', async () => {
      // Logic inside checkPermission calls checkProjectAccess(..., allowArchived=false) for mutations
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
        archivedAt: new Date(),
      });

      await expect(service.checkPermission(projectId, userId, permKey)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getUserProjectRole', () => {
    it('should return ADMIN (Global) if user is admin', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other',
        members: [],
      });

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBe('ADMIN (Global)');
    });

    it('should return OWNER if user is owner', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: userId });

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBe('OWNER');
    });

    it('should return member role name/type if user is member', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: false });
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other',
        members: [{ role: { name: 'Editor', systemType: 'EDITOR' } }],
      });

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBe('EDITOR');
    });
  });
});
