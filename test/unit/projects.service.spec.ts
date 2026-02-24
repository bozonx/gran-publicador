import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { SystemRoleType, PermissionKey } from '../../src/common/types/permissions.types.js';
import { NotificationsService } from '../../src/modules/notifications/notifications.service.js';
import { RolesService } from '../../src/modules/roles/roles.service.js';
import { I18nService } from 'nestjs-i18n';

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
      findFirst: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    user: {
      findFirst: jest.fn() as any,
      findUnique: jest.fn() as any,
    },
    publication: {
      groupBy: jest.fn() as any,
      count: jest.fn() as any,
      findFirst: jest.fn() as any,
    },
    post: {
      groupBy: jest.fn() as any,
      count: jest.fn() as any,
    },
    channel: {
      findMany: jest.fn() as any,
      count: jest.fn() as any,
      groupBy: jest.fn() as any,
    },
    projectMember: {
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      findMany: jest.fn() as any,
      count: jest.fn() as any,
    },
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
    checkPermission: jest.fn() as any,
  };

  const mockNotificationsService = {
    create: jest.fn() as any,
  };

  const mockRolesService = {
    createDefaultRoles: jest.fn() as any,
  };

  const mockI18nService = {
    t: jest.fn() as any,
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
        {
          provide: RolesService,
          useValue: mockRolesService,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: I18nService,
          useValue: mockI18nService,
        },
      ],
    }).compile();

    service = moduleRef.get<ProjectsService>(ProjectsService);

    // Silence logger for tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  describe('findOne', () => {
    it('should return project details with computed counters', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';

      mockPrismaService.project.findUnique.mockResolvedValue({
        id: projectId,
        name: 'Test Project',
        description: null,
        ownerId: userId,
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
        archivedBy: null,
        owner: { id: userId, fullName: null, telegramUsername: 'u1' },
      });

      mockPermissionsService.getUserProjectRole.mockResolvedValue('OWNER');

      mockPrismaService.projectMember.count.mockResolvedValue(0);
      mockPrismaService.channel.count.mockResolvedValue(2);
      mockPrismaService.publication.count.mockResolvedValueOnce(5).mockResolvedValueOnce(1);

      mockPrismaService.publication.findFirst.mockResolvedValue({
        id: 'pub-1',
        createdAt: new Date('2025-01-01'),
      });

      mockPrismaService.channel.findMany.mockResolvedValue([
        {
          id: 'ch-1',
          socialMedia: 'telegram',
          credentials: { token: 'x' },
          preferences: {},
          posts: [{ publishedAt: new Date('2025-01-02'), createdAt: new Date('2025-01-02') }],
        },
        {
          id: 'ch-2',
          socialMedia: 'telegram',
          credentials: {},
          preferences: {},
          posts: [],
        },
      ]);

      mockPrismaService.channel.groupBy.mockResolvedValue([
        { language: 'en-US' },
        { language: 'ru-RU' },
      ]);
      mockPrismaService.post.count.mockResolvedValue(3);
      mockPrismaService.publication.groupBy.mockResolvedValue([
        { status: 'DRAFT', _count: { id: 2 } },
        { status: 'PUBLISHED', _count: { id: 1 } },
      ]);

      const result = await service.findOne(projectId, userId, true);

      expect(result).toMatchObject({
        id: projectId,
        role: 'owner',
        channelCount: 2,
        publicationsCount: 5,
        memberCount: 1,
        lastPublicationId: 'pub-1',
        failedPostsCount: 3,
        problemPublicationsCount: 1,
      });
      expect(result.languages).toEqual(expect.arrayContaining(['en-US', 'ru-RU']));
      expect(result.publicationsSummary).toMatchObject({
        DRAFT: 2,
        PUBLISHED: 1,
      });
    });

    it('should throw NotFoundException when archived and allowArchived=false', async () => {
      mockPrismaService.project.findUnique.mockResolvedValue({
        id: 'project-archived',
        name: 'Archived',
        description: null,
        ownerId: 'u1',
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: new Date(),
        archivedBy: 'u1',
        owner: { id: 'u1', fullName: null, telegramUsername: 'u1' },
      });

      await expect(service.findOne('project-archived', 'u1', false)).rejects.toThrow(
        NotFoundException,
      );
    });
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
          projectTemplate: {
            create: (jest.fn() as any).mockResolvedValue({
              id: 'tpl-1',
              projectId: mockProject.id,
              name: 'Стандартный',
            }),
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
          members: [{ role: { name: 'EDITOR' } }],
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
      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.PROJECT_UPDATE,
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
        role: SystemRoleType.VIEWER,
      });

      await service.addMember(projectId, userId, {
        username: '@newuser',
        roleId: 'role-viewer-id',
      });

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.PROJECT_UPDATE,
      );
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: { telegramUsername: 'newuser' },
      });
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith({
        data: { projectId, userId: userToAdd.id, roleId: 'role-viewer-id' },
        include: { user: true, role: true },
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
        role: SystemRoleType.EDITOR,
      });

      // Mock RegExp checking in service (which we can't easily mock since it's inline, but we pass digits)

      await service.addMember(projectId, userId, {
        username: '123456789',
        roleId: 'role-editor-id',
      });

      // Should have called findUnique with BigInt
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: 123456789n },
      });
      expect(mockPrismaService.projectMember.create).toHaveBeenCalledWith({
        data: { projectId, userId: userToAdd.id, roleId: 'role-editor-id' },
        include: { user: true, role: true },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue(null);
      mockPrismaService.user.findUnique.mockResolvedValue(null); // Just in case logic tries both

      await expect(
        service.addMember('proj', 'user', { username: '@unknown', roleId: 'role-viewer-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user already member', async () => {
      mockPrismaService.user.findFirst.mockResolvedValue({ id: 'u2' });
      mockPrismaService.projectMember.findUnique.mockResolvedValue({ id: 'm1' });

      await expect(
        service.addMember('proj', 'user', { username: '@exist', roleId: 'role-viewer-id' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findMembers', () => {
    it('should return members including virtual owner', async () => {
      const projectId = 'proj-1';
      const userId = 'user-1';
      const owner = { id: 'owner-u', telegramUsername: 'owner' };
      const member = { id: 'm1', userId: 'u2', role: SystemRoleType.ADMIN, user: { id: 'u2' } };

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
      const roleId = 'role-editor-id';

      mockPrismaService.projectMember.findUnique.mockResolvedValue({
        id: 'm1',
        role: SystemRoleType.VIEWER,
      });
      mockPrismaService.projectMember.update.mockResolvedValue({ id: 'm1', roleId });

      await service.updateMemberRole(projectId, userId, memberUserId, { roleId });

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.PROJECT_UPDATE,
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
        role: SystemRoleType.VIEWER,
      });
      mockPrismaService.projectMember.delete.mockResolvedValue({ id: 'm1' });

      await service.removeMember(projectId, userId, memberUserId);

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.PROJECT_UPDATE,
      );
      expect(mockPrismaService.projectMember.delete).toHaveBeenCalled();
    });
  });
});
