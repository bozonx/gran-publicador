import { Test, type TestingModule } from '@nestjs/testing';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { ForbiddenException } from '@nestjs/common';
import { ProjectRole } from '../../src/generated/prisma/client.js';
import { jest } from '@jest/globals';

describe('PermissionsService (unit)', () => {
  let service: PermissionsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
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
    it('should grant access if user is owner', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: userId,
        members: [],
      });

      await expect(service.checkProjectAccess(projectId, userId)).resolves.not.toThrow();
    });

    it('should grant access if user is a member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other-owner',
        members: [{ role: 'EDITOR' }],
      });

      await expect(service.checkProjectAccess(projectId, userId)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.checkProjectAccess(projectId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is neither owner nor member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: 'other-owner',
        members: [],
      });

      await expect(service.checkProjectAccess(projectId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('checkProjectPermission', () => {
    const allowedRoles = [ProjectRole.EDITOR, ProjectRole.ADMIN];

    it('should grant access to owner regardless of roles', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: userId });

      await expect(
        service.checkProjectPermission(projectId, userId, allowedRoles),
      ).resolves.not.toThrow();
    });

    it('should grant access to member with allowed role', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: 'other' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId,
        userId,
        role: ProjectRole.EDITOR,
      });

      await expect(
        service.checkProjectPermission(projectId, userId, allowedRoles),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException for member with insufficient role', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: 'other' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        projectId,
        userId,
        role: ProjectRole.VIEWER,
      });

      await expect(service.checkProjectPermission(projectId, userId, allowedRoles)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: 'other' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      await expect(service.checkProjectPermission(projectId, userId, allowedRoles)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      await expect(service.checkProjectPermission(projectId, userId, allowedRoles)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getUserProjectRole', () => {
    it('should return OWNER if user is owner', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: userId });

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBe(ProjectRole.OWNER);
    });

    it('should return member role if user is member', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: 'other' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({ role: ProjectRole.EDITOR });

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBe(ProjectRole.EDITOR);
    });

    it('should return null if user is not associated', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({ id: projectId, ownerId: 'other' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBeNull();
    });

    it('should return null if project not found', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue(null);

      const role = await service.getUserProjectRole(projectId, userId);
      expect(role).toBeNull();
    });
  });
});
