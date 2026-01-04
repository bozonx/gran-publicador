import { Test, type TestingModule } from '@nestjs/testing';
import { ArchiveService } from '../../src/modules/archive/archive.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { ArchiveEntityType } from '../../src/modules/archive/dto/archive.dto.js';
import { jest } from '@jest/globals';

describe('ArchiveService', () => {
  let service: ArchiveService;

  const mockPrismaService = {
    project: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    channel: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    publication: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    post: {
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
      findMany: jest.fn() as any,
    },
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
    checkProjectPermission: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArchiveService,
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

    service = module.get<ArchiveService>(ArchiveService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('archiveEntity', () => {
    it('should archive a project', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';
      const mockProject = {
        id: projectId,
        name: 'Test Project',
        archivedAt: new Date(),
        archivedBy: userId,
      };

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.project.update.mockResolvedValue(mockProject);

      const result = await service.archiveEntity(ArchiveEntityType.PROJECT, projectId, userId);

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          archivedAt: expect.any(Date),
          archivedBy: userId,
        },
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('restoreEntity', () => {
    it('should restore an archived project', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';
      const mockProject = {
        id: projectId,
        name: 'Test Project',
        archivedAt: null,
        archivedBy: null,
      };

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.project.update.mockResolvedValue(mockProject);

      const result = await service.restoreEntity(ArchiveEntityType.PROJECT, projectId, userId);

      expect(mockPrismaService.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: {
          archivedAt: null,
          archivedBy: null,
        },
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('deleteEntityPermanently', () => {
    it('should permanently delete a project', async () => {
      const projectId = 'project-1';
      const userId = 'user-1';
      const mockProject = {
        id: projectId,
        name: 'Test Project',
      };

      mockPermissionsService.checkProjectPermission.mockResolvedValue(undefined);
      mockPrismaService.project.delete.mockResolvedValue(mockProject);

      const result = await service.deleteEntityPermanently(ArchiveEntityType.PROJECT, projectId, userId);

      expect(mockPrismaService.project.delete).toHaveBeenCalledWith({
        where: { id: projectId },
      });
      expect(result).toEqual(mockProject);
    });
  });

  describe('isEntityArchived', () => {
    it('should return true if project is archived', async () => {
      const projectId = 'project-1';
      const mockProject = {
        id: projectId,
        archivedAt: new Date(),
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.isEntityArchived(ArchiveEntityType.PROJECT, projectId);

      expect(result).toBe(true);
    });

    it('should return true if channel is archived via project (virtual cascading)', async () => {
      const channelId = 'channel-1';
      const mockChannel = {
        id: channelId,
        archivedAt: null,
        project: {
          archivedAt: new Date(),
        },
      };

      mockPrismaService.channel.findUnique.mockResolvedValue(mockChannel);

      const result = await service.isEntityArchived(ArchiveEntityType.CHANNEL, channelId);

      expect(result).toBe(true);
    });

    it('should return false if entity is not archived', async () => {
      const projectId = 'project-1';
      const mockProject = {
        id: projectId,
        archivedAt: null,
      };

      mockPrismaService.project.findUnique.mockResolvedValue(mockProject);

      const result = await service.isEntityArchived(ArchiveEntityType.PROJECT, projectId);

      expect(result).toBe(false);
    });
  });

  describe('getArchiveStats', () => {
    it('should return archive statistics', async () => {
      mockPrismaService.project.count.mockResolvedValue(5);
      mockPrismaService.channel.count.mockResolvedValue(10);
      mockPrismaService.publication.count.mockResolvedValue(3);

      const stats = await service.getArchiveStats();

      expect(stats).toEqual({
        projects: 5,
        channels: 10,
        publications: 3,
        posts: 0,
        total: 18,
      });
    });
  });

  describe('moveEntity', () => {
    it('should move a channel to a different project', async () => {
      const channelId = 'channel-1';
      const targetProjectId = 'project-2';
      const mockChannel = {
        id: channelId,
        projectId: targetProjectId,
      };

      mockPrismaService.channel.update.mockResolvedValue(mockChannel);

      const result = await service.moveEntity(
        ArchiveEntityType.CHANNEL,
        channelId,
        targetProjectId,
      );

      expect(mockPrismaService.channel.update).toHaveBeenCalledWith({
        where: { id: channelId },
        data: { projectId: targetProjectId },
      });
      expect(result).toEqual(mockChannel);
    });
  });
});
