import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest } from '@jest/globals';
import { ProjectRole } from '../../src/generated/prisma/client.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';

describe('ProjectsService (unit)', () => {
  let service: ProjectsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    $transaction: jest.fn() as any,
    $queryRaw: jest.fn() as any,
    project: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    projectMember: {
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    user: {
      findFirst: jest.fn() as any,
      findUnique: jest.fn() as any,
    },
    publication: {
      groupBy: jest.fn() as any,
      count: jest.fn() as any,
    },
    post: {
      groupBy: jest.fn() as any,
    },
    channel: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      groupBy: jest.fn() as any,
    },
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
  };

  const mockNotificationsService = {
    create: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = moduleRef.get<ProjectsService>(ProjectsService);

    // Silence logger for tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create project but not add owner as member (handled via ownerId)', async () => {
      const userId = 'user-1';
      const createData = {
        name: 'Test Project',
        description: 'Test Description',
      };

      const mockProject = {
        id: 'project-1',
        ...createData,
        ownerId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock transaction
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          project: {
            create: (jest.fn() as any).mockResolvedValue(mockProject),
          },
          // projectMember.create should NOT be called for owner anymore
        };
        return await callback(tx);
      });

      const result = await service.create(userId, createData);

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findAllForUser', () => {
    it('should return all projects where user is a member or owner', async () => {
      const userId = 'user-1';
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          ownerId: 'user-1', // User IS owner
          members: [], // No explicit member entry
          _count: { channels: 5, publications: 3 },
          publications: [{ createdAt: new Date('2024-01-01') }],
          channels: [],
        },
        {
          id: 'project-2',
          name: 'Project 2',
          ownerId: 'other-user',
          members: [{ role: 'EDITOR' }],
          _count: { channels: 2, publications: 0 },
          publications: [],
          channels: [],
        },
      ];

      mockPrismaService.project.findMany.mockResolvedValue(mockProjects);
      mockPrismaService.publication.groupBy.mockResolvedValue([]);
      mockPrismaService.post.groupBy.mockResolvedValue([]);
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockPrismaService.channel.groupBy.mockResolvedValue([]);
      mockPrismaService.channel.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'project-1',
        role: 'owner', // Should be inferred from ownerId
        channelCount: 5,
        publicationsCount: 3,
      });
      expect(result[0].lastPublicationAt).toBeInstanceOf(Date);
      expect(result[1]).toMatchObject({
        id: 'project-2',
        role: 'editor',
        channelCount: 2,
        publicationsCount: 0,
        lastPublicationAt: null,
      });
    });
  });

  describe('update', () => {
    it('should allow ADMIN to update project (OWNER is allowed implicitly)', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';
      const updateData = { name: 'Updated Name' };

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);

      const updatedProject = {
        id: projectId,
        ...updateData,
      };

      mockPrismaService.project.update.mockResolvedValue(updatedProject);

      const result = await service.update(projectId, userId, updateData);

      expect(result).toEqual(updatedProject);
      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        ['ADMIN'], // Removed OWNER
      );
    });
  });

  describe('addMember', () => {
    it('should add a member by username', async () => {
      const projectId = 'proj-1';
      const userId = 'user-1';
      const userToAdd = { id: 'user-2', telegramUsername: 'newuser' };

      mockPrismaService.user.findFirst.mockResolvedValue(userToAdd);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue({
        userId: userToAdd.id,
        role: ProjectRole.VIEWER,
      });

      await service.addMember(projectId, userId, {
        username: '@newuser',
        role: ProjectRole.VIEWER,
      });

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        [ProjectRole.ADMIN],
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { telegramUsername: 'newuser' },
      });
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith({
        data: { projectId, userId: userToAdd.id, role: ProjectRole.VIEWER },
        include: { user: true },
      });
    });

    it('should add a member by telegram ID', async () => {
      const projectId = 'proj-1';
      const userId = 'user-1';
      const userToAdd = { id: 'user-3', telegramId: 123456789n };

      mockPrismaService.user.findUnique.mockResolvedValue(userToAdd);
      mockPrismaService.projectMember.findUnique.mockResolvedValue(null);
      mockPrismaService.projectMember.create.mockResolvedValue({
        userId: userToAdd.id,
        role: ProjectRole.EDITOR,
      });

      // Mock RegExp checking in service (which we can't easily mock since it's inline, but we pass digits)

      await service.addMember(projectId, userId, {
        username: '123456789',
        role: ProjectRole.EDITOR,
      });

      // Should have called findUnique with BigInt
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n },
      });
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith({
        data: { projectId, userId: userToAdd.id, role: ProjectRole.EDITOR },
        include: { user: true },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null); // Just in case logic tries both

      await expect(
        service.addMember('proj', 'user', { username: '@unknown', role: ProjectRole.VIEWER }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user already member', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'u2' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      await expect(
        service.addMember('proj', 'user', { username: '@exist', role: ProjectRole.VIEWER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findMembers', () => {
    it('should return members including virtual owner', async () => {
      const projectId = 'proj-1';
      const userId = 'user-1';
      const owner = { id: 'owner-u', telegramUsername: 'owner' };
      const member = { id: 'm1', userId: 'u2', role: ProjectRole.ADMIN, user: { id: 'u2' } };

      mockPrismaService.projectMember.findMany.mockResolvedValue([member]);
      // Mock findUnique logic for owner injection
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        ownerId: owner.id,
        owner,
        createdAt: new Date(),
      });

      const result = await service.findMembers(projectId, userId);

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('OWNER');
      expect(result[0].userId).toBe(owner.id);
      expect(result[1]).toBe(member);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const memberUserId = 'u2';
      const role = ProjectRole.EDITOR;

      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        id: 'm1',
        role: ProjectRole.VIEWER,
      });
      mockPrismaService.projectMember.update.mockResolvedValue({ id: 'm1', role });

      await service.updateMemberRole(projectId, userId, memberUserId, { role });

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        [ProjectRole.ADMIN],
      );
      expect(mockPrismaService.projectMember.update).toHaveBeenCalled();
    });
  });

  describe('removeMember', () => {
    it('should remove member', async () => {
      const projectId = 'p1';
      const userId = 'u1';
      const memberUserId = 'u2';

      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        id: 'm1',
        role: ProjectRole.VIEWER,
      });
      mockPrismaService.projectMember.delete.mockResolvedValue({ id: 'm1' });

      await service.removeMember(projectId, userId, memberUserId);

      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        [ProjectRole.ADMIN],
      );
      expect(mockPrismaService.projectMember.delete).toHaveBeenCalled();
    });
  });
});
