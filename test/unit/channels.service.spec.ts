import { Test, type TestingModule } from '@nestjs/testing';
import { ChannelsService } from '../../src/modules/channels/channels.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { jest } from '@jest/globals';
import { PermissionKey } from '../../src/common/types/permissions.types.js';

describe('ChannelsService (unit)', () => {
  let service: ChannelsService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
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
      ],
    }).compile();

    service = moduleRef.get<ChannelsService>(ChannelsService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
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

      await service.update('c1', userId, { name: 'Updated' });

      expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(
        projectId,
        userId,
        PermissionKey.CHANNELS_UPDATE,
      );
      expect(mockPrismaService.channel.update).toHaveBeenCalled();
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
});
