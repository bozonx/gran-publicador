import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from '../../src/modules/media/media.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { MediaType, StorageType } from '../../src/generated/prisma/index.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { Readable } from 'stream';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

describe('MediaService (unit)', () => {
  let service: MediaService;
  let moduleRef: TestingModule;
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  const mockPrismaService = {
    media: {
      create: jest.fn() as any,
      findMany: jest.fn() as any,
      findUnique: jest.fn() as any,
      update: jest.fn() as any,
      delete: jest.fn() as any,
    },
    project: {
      findUnique: jest.fn() as any,
      findMany: jest.fn() as any,
    },
  };

  const mockConfigService = {
    get: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
  };

  const mockMediaConfig = {
    serviceUrl: 'http://localhost:8083/api/v1',
    appId: 'gran-publicador',
    timeoutSecs: 5,
    maxFileSizeMb: 10,
    thumbnailQuality: 75,
  };

  beforeAll(async () => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);

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
    setGlobalDispatcher(originalDispatcher);
    await moduleRef.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'media') return mockMediaConfig;
      if (key === 'app.jwtSecret') return 'test-jwt-secret';
      return null;
    });
  });

  afterEach(() => {
    // Ensure no interceptors are left pending
    mockAgent.assertNoPendingInterceptors();
  });

  describe('create', () => {
    it('should create a media record', async () => {
      const createDto = {
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: 'file-id-123',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024n,
        meta: { checksum: 'abc' } as any,
      };

      const dbResponse = {
        id: 'media-1',
        ...createDto,
        meta: createDto.meta,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.media.create.mockResolvedValue(dbResponse);

      const result = await service.create(createDto);

      expect(result.id).toBe('media-1');
      expect(result.meta).toEqual(createDto.meta);
    });
  });

  describe('uploadFileToStorage', () => {
    it('should upload file and return storage info', async () => {
      const buffer = Buffer.from('test');
      const stream = Readable.from([buffer]);
      const filename = 'test.txt';
      const mimetype = 'text/plain';

      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files',
          method: 'POST',
        })
        .reply(200, {
          id: 'storage-id-123',
          originalSize: 4,
          size: 4,
          mimeType: 'text/plain',
          checksum: 'hash',
          url: 'http://storage/file',
        });

      client
        .intercept({
          path: '/api/v1/files/storage-id-123/confirm',
          method: 'POST',
        })
        .reply(200, {});

      const result = await service.uploadFileToStorage(stream, filename, mimetype);
      expect(result.fileId).toBe('storage-id-123');
      expect(result.metadata.checksum).toBe('hash');
    });

    it('should throw error if storage returns non-ok response', async () => {
      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files',
          method: 'POST',
        })
        .reply(400, { message: 'Error' });

      await expect(
        service.uploadFileToStorage(Readable.from([Buffer.from('')]), 'f', 'm'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('uploadFileFromUrl', () => {
    it('should upload file from URL and return storage info', async () => {
      const url = 'https://example.com/image.jpg';
      const filename = 'image.jpg';

      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files/from-url',
          method: 'POST',
        })
        .reply(200, {
          id: 'storage-id-456',
          originalSize: 1024,
          size: 800,
          mimeType: 'image/jpeg',
          checksum: 'hash123',
          url: 'http://storage/file',
        });

      client
        .intercept({
          path: '/api/v1/files/storage-id-456/confirm',
          method: 'POST',
        })
        .reply(200, {});

      const result = await service.uploadFileFromUrl(url, filename);
      expect(result.fileId).toBe('storage-id-456');
    });
  });

  describe('remove', () => {
    it('should delete from storage and database', async () => {
      const mediaId = 'media-1';
      const mockMedia = {
        id: mediaId,
        storageType: StorageType.FS,
        storagePath: 'file-id-123',
        meta: {},
      };

      mockPrismaService.media.findUnique.mockResolvedValue(mockMedia);
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);

      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files/file-id-123',
          method: 'DELETE',
        })
        .reply(200, {});

      const result = await service.remove(mediaId);
      expect(result).toEqual(mockMedia);
    });
  });

  describe('replaceFsMediaFile', () => {
    it('should replace FS file, update DB meta, and delete old storage file', async () => {
      const mediaId = 'media-1';
      const oldStoragePath = 'old-file-id';
      const newStoragePath = 'new-file-id';

      mockPrismaService.media.findUnique.mockResolvedValue({
        id: mediaId,
        storageType: StorageType.FS,
        storagePath: oldStoragePath,
        meta: { customKey: 'customValue', width: 10 },
      });

      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files',
          method: 'POST',
        })
        .reply(200, {
          id: newStoragePath,
          originalSize: 200,
          size: 100,
          width: 20,
          height: 30,
          mimeType: 'image/jpeg',
          checksum: 'hash',
          url: 'http://storage/file',
        });

      client
        .intercept({
          path: `/api/v1/files/${newStoragePath}/confirm`,
          method: 'POST',
        })
        .reply(200, {});

      client
        .intercept({
          path: `/api/v1/files/${oldStoragePath}`,
          method: 'DELETE',
        })
        .reply(200, {});

      mockPrismaService.media.update.mockResolvedValue({
        id: mediaId,
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: newStoragePath,
        filename: 'new.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 100n,
        meta: {
          customKey: 'customValue',
          originalSize: 200,
          size: 100,
          width: 20,
          height: 30,
          mimeType: 'image/jpeg',
          checksum: 'hash',
          url: 'http://storage/file',
          gp: { editedAt: new Date().toISOString() },
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.replaceFsMediaFile(
        mediaId,
        Readable.from([Buffer.from('data')]),
        'new.jpg',
        'image/jpeg',
        'user-1',
      );

      expect(result.id).toBe(mediaId);
      expect(result.storagePath).toBe(newStoragePath);
      expect(result.meta.customKey).toBe('customValue');
      expect(result.meta.width).toBe(20);
      expect(result.meta.gp?.editedAt).toBeDefined();
    });

    it('should throw for non-image mimetype', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue({
        id: 'media-1',
        storageType: StorageType.FS,
        storagePath: 'old-file-id',
        meta: {},
      });

      await expect(
        service.replaceFsMediaFile(
          'media-1',
          Readable.from([Buffer.from('data')]),
          'new.txt',
          'text/plain',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-FS media', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue({
        id: 'media-1',
        storageType: StorageType.TELEGRAM,
        storagePath: 'tg-file-id',
        meta: {},
      });

      await expect(
        service.replaceFsMediaFile(
          'media-1',
          Readable.from([Buffer.from('data')]),
          'new.jpg',
          'image/jpeg',
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getFileStream', () => {
    it('should proxy stream from storage', async () => {
      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: '/api/v1/files/file-id/download',
          method: 'GET',
        })
        .reply(200, Buffer.from('data'), {
          headers: { 'content-type': 'image/jpeg' },
        });

      const result = await service.getFileStream('file-id');
      expect(result.headers['content-type']).toBe('image/jpeg');
      expect(result.status).toBe(200);
    });
  });

  describe('getThumbnailStream', () => {
    it('should proxy thumbnail request', async () => {
      const client = mockAgent.get('http://localhost:8083');
      client
        .intercept({
          path: /^\/api\/v1\/files\/file-id\/thumbnail.*/,
          method: 'GET',
        })
        .reply(200, Buffer.from('thumb'), {
          headers: { 'content-type': 'image/jpeg' },
        });

      const result = await service.getThumbnailStream('file-id', 100, 100, 80);
      expect(result.status).toBe(200);
    });
  });

  describe('checkMediaAccess', () => {
    it('should allow access if media not linked to publications', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue({
        id: 'media-1',
        publicationMedia: [],
      });

      await expect(service.checkMediaAccess('media-1', 'user-1')).resolves.not.toThrow();
    });
  });
});
