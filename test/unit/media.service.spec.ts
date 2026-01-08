import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from '../../src/modules/media/media.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { MediaType, StorageType } from '../../src/generated/prisma/client.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';

describe('MediaService (unit)', () => {
  let service: MediaService;
  let moduleRef: TestingModule;

  const mockPrismaService = {
    media: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    mediaGroup: {
      create: jest.fn() as any,
      findUnique: jest.fn() as any,
    },
    $transaction: jest.fn() as any,
  };

  const mockConfigService = {
    get: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    // Mock config service to return app config
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'app') {
        return {
          media: {
            maxFileSize: 52428800, // 50MB
          },
          telegramBotToken: 'test-bot-token',
        };
      }
      if (key === 'app.telegramBotToken') {
        return 'test-bot-token';
      }
      return undefined;
    });

    moduleRef = await Test.createTestingModule({
      providers: [
        MediaService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PermissionsService,
          useValue: mockPermissionsService,
        },
      ],
    }).compile();

    service = moduleRef.get<MediaService>(MediaService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a media record', async () => {
      const createDto = {
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: '2026/01/test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        meta: { width: 800, height: 600 },
      };

      const dbResponse = {
        id: 'media-1',
        ...createDto,
        meta: JSON.stringify(createDto.meta),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expectedResult = {
        ...dbResponse,
        meta: createDto.meta,
      };

      mockPrismaService.media.create.mockResolvedValue(dbResponse);

      const result = await service.create(createDto);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.media.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          meta: JSON.stringify(createDto.meta),
        },
      });
    });

    it('should handle empty meta object', async () => {
      const createDto = {
        type: MediaType.DOCUMENT,
        storageType: StorageType.FS,
        storagePath: 'https://example.com/doc.pdf',
        filename: 'document.pdf',
      };

      const expectedMedia = {
        id: 'media-2',
        ...createDto,
        meta: '{}',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.media.create.mockResolvedValue(expectedMedia);

      await service.create(createDto as any);

      expect(mockPrismaService.media.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          meta: '{}',
        }),
      });
    });
  });

  describe('findOne', () => {
    it('should return media with parsed meta', async () => {
      const mediaId = 'media-1';
      const mockMedia = {
        id: mediaId,
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: 'test.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        meta: JSON.stringify({ width: 800 }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.media.findUnique.mockResolvedValue(mockMedia);

      const result = await service.findOne(mediaId);

      expect(result.meta).toEqual({ width: 800 });
      expect(mockPrismaService.media.findUnique).toHaveBeenCalledWith({
        where: { id: mediaId },
      });
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('non-existent')).rejects.toThrow('Media with ID non-existent not found');
    });
  });

  describe('findAll', () => {
    it('should return all media ordered by createdAt desc', async () => {
      const mockMedia = [
        { id: 'media-1', createdAt: new Date('2026-01-02') },
        { id: 'media-2', createdAt: new Date('2026-01-01') },
      ];

      mockPrismaService.media.findMany.mockResolvedValue(mockMedia);

      const result = await service.findAll();

      expect(result).toEqual(mockMedia);
      expect(mockPrismaService.media.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('update', () => {
    it('should update media metadata', async () => {
      const mediaId = 'media-1';
      const updateDto = {
        filename: 'updated.jpg',
        meta: { width: 1920, height: 1080 },
      };

      const existingMedia = {
        id: mediaId,
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: 'test.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedMediaDb = {
        ...existingMedia,
        ...updateDto,
        meta: JSON.stringify(updateDto.meta),
      };

      const expectedResult = {
        ...updatedMediaDb,
        meta: updateDto.meta,
      };

      mockPrismaService.media.findUnique.mockResolvedValue(existingMedia);
      mockPrismaService.media.update.mockResolvedValue(updatedMediaDb);

      const result = await service.update(mediaId, updateDto);

      expect(result).toEqual(expectedResult);
      expect(mockPrismaService.media.update).toHaveBeenCalledWith({
        where: { id: mediaId },
        data: {
          ...updateDto,
          meta: JSON.stringify(updateDto.meta),
        },
      });
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete media using transaction', async () => {
      const mediaId = 'media-1';
      const mockMedia = {
        id: mediaId,
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: 'https://example.com/image.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.media.findUnique.mockResolvedValue(mockMedia);

      // Mock transaction
      mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
        const txMock = {
          media: {
            delete: jest.fn().mockResolvedValue(mockMedia),
          },
        };
        return callback(txMock);
      });

      const result = await service.remove(mediaId);

      expect(result).toEqual(mockMedia);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if media not found', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createGroup', () => {
    it('should create media group with items', async () => {
      const createDto = {
        name: 'Test Gallery',
        description: 'Test description',
        items: [
          { mediaId: 'media-1', order: 0 },
          { mediaId: 'media-2', order: 1 },
        ],
      };

      const expectedGroup = {
        id: 'group-1',
        name: createDto.name,
        description: createDto.description,
        items: [
          { id: 'item-1', mediaGroupId: 'group-1', mediaId: 'media-1', order: 0, media: { id: 'media-1' } },
          { id: 'item-2', mediaGroupId: 'group-1', mediaId: 'media-2', order: 1, media: { id: 'media-2' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.mediaGroup.create.mockResolvedValue(expectedGroup);

      const result = await service.createGroup(createDto);

      expect(result).toEqual(expectedGroup);
      expect(mockPrismaService.mediaGroup.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          description: createDto.description,
          items: {
            create: [
              { media: { connect: { id: 'media-1' } }, order: 0 },
              { media: { connect: { id: 'media-2' } }, order: 1 },
            ],
          },
        },
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
        },
      });
    });
  });

  describe('findGroup', () => {
    it('should return media group with items', async () => {
      const groupId = 'group-1';
      const mockGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Test description',
        items: [
          { id: 'item-1', mediaId: 'media-1', order: 0, media: { id: 'media-1' } },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.mediaGroup.findUnique.mockResolvedValue(mockGroup);

      const result = await service.findGroup(groupId);

      expect(result).toEqual(mockGroup);
      expect(mockPrismaService.mediaGroup.findUnique).toHaveBeenCalledWith({
        where: { id: groupId },
        include: {
          items: {
            include: { media: true },
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should throw NotFoundException if group not found', async () => {
      mockPrismaService.mediaGroup.findUnique.mockResolvedValue(null);

      await expect(service.findGroup('non-existent')).rejects.toThrow(NotFoundException);
      await expect(service.findGroup('non-existent')).rejects.toThrow('MediaGroup with ID non-existent not found');
    });
  });

  describe('validation', () => {
    it('should validate max file size in saveFile', async () => {
      const largeBuffer = Buffer.alloc(53 * 1024 * 1024); // 53MB - exceeds limit
      const file = {
        filename: 'large.jpg',
        buffer: largeBuffer,
        mimetype: 'image/jpeg',
      };

      await expect(service.saveFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.saveFile(file)).rejects.toThrow('File size exceeds limit');
    });

    it('should reject executable files by mime type', async () => {
      const file = {
        filename: 'virus.exe',
        buffer: Buffer.from('bad'),
        mimetype: 'application/x-msdownload',
      };
      await expect(service.saveFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.saveFile(file)).rejects.toThrow('Executable or script files are not allowed');
    });

    it('should reject executable files by extension', async () => {
      const file = {
        filename: 'script.vbS', // Mixed case check
        buffer: Buffer.from('bad'),
        mimetype: 'text/plain', // Mimetype might look innocent
      };
      await expect(service.saveFile(file)).rejects.toThrow(BadRequestException);
      await expect(service.saveFile(file)).rejects.toThrow('Executable or script file extensions are not allowed');
    });
  });
});
