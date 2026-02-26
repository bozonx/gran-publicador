import { Test, type TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../../src/modules/channels/channels.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { ChannelsMapper } from '../../src/modules/channels/channels.mapper.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PermissionKey } from '../../src/common/types/permissions.types.js';

describe('ChannelsService (unit)', () => {
  let service: ChannelsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn() as any,
    },
    project: {
      findMany: jest.fn() as any,
    },
    channel: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
      count: jest.fn() as any,
    },
    post: {
      groupBy: jest.fn() as any,
      findMany: jest.fn() as any,
    },
    publication: {
      deleteMany: jest.fn() as any,
    },
    projectTemplate: {
      findMany: jest.fn() as any,
    },
    $transaction: jest.fn((callback: any) => callback(mockPrismaService)) as any,
  };

  const mockPermissionsService = {
    checkPermission: jest.fn() as any,
    checkProjectAccess: jest.fn() as any,
    getUserProjectRole: jest.fn() as any,
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ChannelsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PermissionsService, useValue: mockPermissionsService },
        { provide: ChannelsMapper, useValue: { mapToDto: jest.fn((v: any) => v) } },
      ],
    }).compile();

    service = moduleRef.get<ChannelsService>(ChannelsService);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrismaService.user.findUnique.mockResolvedValue({ isAdmin: true });
  });

  const projectId = 'proj-1';
  const userId = 'user-1';

  describe('create', () => {
    it('should check CHANNELS_CREATE permission and create channel', async () => {
      mockPrismaService.channel.create.mockResolvedValue({ id: 'c1' });

      await service.create(userId, projectId, {
        name: 'New Channel',
        socialMedia: 'TELEGRAM',
        channelIdentifier: '@test',
        language: 'en',
      });

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.CHANNELS_CREATE,
      );
      expect(mockPrismaService.channel.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should check CHANNELS_UPDATE permission and update channel', async () => {
      mockPrismaService.channel.findUnique.mockResolvedValue({ id: 'c1', projectId });
      mockPermissionsService.getUserProjectRole.mockResolvedValue('editor');
      mockPrismaService.post.groupBy.mockResolvedValue([]);
      mockPrismaService.projectTemplate.findMany.mockResolvedValue([]);

      await service.update('c1', userId, { name: 'Updated' });

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.CHANNELS_UPDATE,
      );
      expect(mockPrismaService.channel.update).toHaveBeenCalled();
    });

    it('should reject update when preferences reference unknown project template', async () => {
      mockPrismaService.channel.findUnique.mockResolvedValue({ id: 'c1', projectId });
      mockPermissionsService.getUserProjectRole.mockResolvedValue('editor');
      mockPrismaService.post.groupBy.mockResolvedValue([]);

      mockPrismaService.projectTemplate.findMany.mockResolvedValue([{ id: 'tpl-1' }]);

      await expect(
        service.update('c1', userId, {
          preferences: {
            templates: [
              {
                projectTemplateId: 'tpl-missing',
              },
            ],
          },
        } as any),
      ).rejects.toThrow('Channel preferences contain unknown projectTemplateId');

      expect(mockPrismaService.channel.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should check CHANNELS_DELETE permission and remove channel', async () => {
      mockPrismaService.channel.findUnique.mockResolvedValue({ id: 'c1', projectId });
      mockPrismaService.channel.delete.mockResolvedValue({ id: 'c1' });
      mockPrismaService.post.findMany.mockResolvedValue([]); // No linked posts

      await service.remove('c1', userId);

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.CHANNELS_DELETE,
      );
      expect(mockPrismaService.channel.delete).toHaveBeenCalled();
    });
  });

  describe('findAllForProject', () => {
    it('should check CHANNELS_READ permission', async () => {
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      mockPrismaService.post.groupBy.mockResolvedValue([]);

      await service.findAllForProject(projectId, userId);

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.CHANNELS_READ,
      );
    });
  });

  describe('findAllForUser sorting', () => {
    it('should sort alphabetically with stable tie-breaker by id', async () => {
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      mockPrismaService.channel.count.mockResolvedValue(0);
      mockPrismaService.post.groupBy.mockResolvedValue([]);

      await service.findAllForUser(userId, {
        sortBy: 'alphabetical',
        sortOrder: 'asc',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaService.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
      );
    });

    it('should sort by postsCount with stable tie-breakers', async () => {
      mockPrismaService.channel.findMany.mockResolvedValue([]);
      mockPrismaService.channel.count.mockResolvedValue(0);
      mockPrismaService.post.groupBy.mockResolvedValue([]);

      await service.findAllForUser(userId, {
        sortBy: 'postsCount',
        sortOrder: 'desc',
        limit: 10,
        offset: 0,
      });

      expect(mockPrismaService.channel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }, { id: 'asc' }],
        }),
      );
    });
  });
});
