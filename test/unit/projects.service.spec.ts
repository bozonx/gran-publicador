import { Test, type TestingModule } from '@nestjs/testing';
import { ForbiddenException, Logger } from '@nestjs/common';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest } from '@jest/globals';

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
    it('should create project and add owner as member in transaction', async () => {
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
          projectMember: {
            create: (jest.fn() as any).mockResolvedValue({
              id: 'member-1',
              projectId: mockProject.id,
              userId,
              role: 'OWNER',
            }),
          },
        };
        return await callback(tx);
      });

      const result = await service.create(userId, createData);

      expect(result).toEqual(mockProject);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findAllForUser', () => {
    it('should return all projects where user is a member', async () => {
      const userId = 'user-1';
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Project 1',
          members: [{ role: 'OWNER' }],
          _count: { channels: 5, publications: 3 },
          publications: [{ createdAt: new Date('2024-01-01') }],
          channels: [],
        },
        {
          id: 'project-2',
          name: 'Project 2',
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
        role: 'owner',
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

  describe('findOne', () => {
    it('should return project with role when user is member', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';

      const mockProject = {
        id: projectId,
        name: 'Test Project',
        channels: [],
        members: [],
        _count: { channels: 0, publications: 0 },
        publications: [],
      };

      mockPermissionsService.getUserProjectRole.mockResolvedValue('EDITOR');
      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);
      mockPrismaService.post.groupBy.mockResolvedValue([]);
      mockPrismaService.publication.count.mockResolvedValue(0);

      const result = await service.findOne(projectId, userId);

      expect(result).toEqual({
        ...mockProject,
        role: 'editor',
        channelCount: 0,
        publicationsCount: 0,
        memberCount: 0,
        lastPublicationAt: null,
        lastPublicationId: null,
        staleChannelsCount: 0,
        preferences: {},
        failedPostsCount: 0,
        problemPublicationsCount: 0,
      });
    });

    it('should throw ForbiddenException when user has no role', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';

      mockPermissionsService.getUserProjectRole.mockResolvedValue(null);

      await expect(service.findOne(projectId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should allow OWNER to update project', async () => {
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
        ['OWNER', 'ADMIN'],
      );
    });

    it('should throw ForbiddenException when EDITOR tries to update', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';
      const updateData = { name: 'Hacked' };

      mockPermissionsService.checkProjectPermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(service.update(projectId, userId, updateData)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('remove', () => {
    it('should allow only OWNER to delete project', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);

      mockPrismaService.project.delete.mockResolvedValue({
        id: projectId,
      });

      await expect(service.remove(projectId, userId)).resolves.toBeDefined();
      expect(mockPermissionsService.checkProjectPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        ['OWNER', 'ADMIN'],
      );
    });

    it('should throw ForbiddenException when ADMIN tries to delete', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';

      mockPermissionsService.checkProjectPermission.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(service.remove(projectId, userId)).rejects.toThrow(ForbiddenException);
    });
  });
});
