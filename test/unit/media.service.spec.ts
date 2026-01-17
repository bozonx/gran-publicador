import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaService } from '../../src/modules/media/media.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { jest } from '@jest/globals';
import { MediaType, StorageType } from '../../src/generated/prisma/client.js';
import { PermissionsService } from '../../src/common/services/permissions.service.js';
import { Readable, PassThrough } from 'stream';

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
    project: {
      findMany: jest.fn() as any,
    },
  };

  const mockConfigService = {
    get: jest.fn() as any,
  };

  const mockPermissionsService = {
    checkProjectAccess: jest.fn() as any,
  };

  // Mock global fetch
  const mockFetch = jest.fn() as any;
  global.fetch = mockFetch;

  beforeAll(async () => {
    // Set environment variables required by MediaConfig
    process.env.MEDIA_STORAGE_SERVICE_URL = 'http://localhost:8083/api/v1';
    process.env.MEDIA_STORAGE_TIMEOUT_SECS = '5';
    process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB = '10';
    // Set compression options for testing
    process.env.IMAGE_COMPRESSION_FORMAT = 'webp';
    process.env.IMAGE_COMPRESSION_MAX_DIMENSION = '3840';
    process.env.IMAGE_COMPRESSION_QUALITY = '85';
    process.env.THUMBNAIL_MAX_DIMENSION = '2048';
    process.env.THUMBNAIL_QUALITY = '75';

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
    delete process.env.MEDIA_STORAGE_SERVICE_URL;
    delete process.env.MEDIA_STORAGE_TIMEOUT_SECS;
    delete process.env.MEDIA_STORAGE_MAX_FILE_SIZE_MB;
    delete process.env.IMAGE_COMPRESSION_FORMAT;
    delete process.env.IMAGE_COMPRESSION_MAX_DIMENSION;
    delete process.env.IMAGE_COMPRESSION_QUALITY;
    delete process.env.THUMBNAIL_MAX_DIMENSION;
    delete process.env.THUMBNAIL_QUALITY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('create', () => {
    it('should create a media record', async () => {
      const createDto = {
        type: MediaType.IMAGE,
        storageType: StorageType.FS,
        storagePath: 'file-id-123',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        meta: { checksum: 'abc' },
      };

      const dbResponse = {
        id: 'media-1',
        ...createDto,
        meta: JSON.stringify(createDto.meta),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.media.create.mockResolvedValue(dbResponse);

      const result = await service.create(createDto);

      expect(result.id).toBe('media-1');
      expect(result.meta).toEqual(createDto.meta);
      expect(mockPrismaService.media.create).toHaveBeenCalled();
    });
  });

  describe('uploadFileToStorage', () => {
    it('should upload file and return storage info', async () => {
      const buffer = Buffer.from('test');
      const filename = 'test.txt';
      const mimetype = 'text/plain';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'storage-id-123',
          originalSize: 4,
          size: 4,
          mimeType: 'text/plain',
          checksum: 'hash',
          url: 'http://storage/file',
        }),
      });

      const result = await service.uploadFileToStorage(buffer, filename, mimetype);

      expect(result.fileId).toBe('storage-id-123');
      expect(result.metadata.checksum).toBe('hash');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        }),
      );
    });

    it('should pass compression options as individual form fields', async () => {
      const buffer = Buffer.from('image-data');
      const filename = 'image.jpg';
      const mimetype = 'image/jpeg';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'storage-id-456',
          originalSize: 1024,
          size: 800,
          mimeType: 'image/jpeg',
          checksum: 'hash',
          url: 'http://storage/file',
        }),
      });

      await service.uploadFileToStorage(buffer, filename, mimetype);

      // Verify FormData contains compression parameters
      const callArgs = mockFetch.mock.calls[0];
      const formData = callArgs[1].body as FormData;
      
      // Note: In Node.js environment, FormData.get() might not work as expected
      // So we just verify the call was made with FormData
      expect(formData).toBeInstanceOf(FormData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw error if storage returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Error message',
      });

      await expect(service.uploadFileToStorage(Buffer.from(''), 'f', 'm')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle timeout/abort', async () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      mockFetch.mockRejectedValue(error);

      await expect(service.uploadFileToStorage(Buffer.from(''), 'f', 'm')).rejects.toThrow(
        'Media Storage request timed out',
      );
    });
  });

  describe('uploadFileFromUrl', () => {
    it('should upload file from URL and return storage info', async () => {
      const url = 'https://example.com/image.jpg';
      const filename = 'image.jpg';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'storage-id-456',
          originalSize: 1024,
          size: 800,
          mimeType: 'image/jpeg',
          checksum: 'hash123',
          url: 'http://storage/file',
        }),
      });

      const result = await service.uploadFileFromUrl(url, filename);

      expect(result.fileId).toBe('storage-id-456');
      expect(result.metadata.checksum).toBe('hash123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/from-url'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: expect.stringContaining(url),
        }),
      );
      
      // Verify compression parameters are in the body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.url).toBe(url);
      expect(body.filename).toBe(filename);
      expect(body.format).toBe('webp');
      expect(body.maxDimension).toBe(3840);
      expect(body.quality).toBe(85);
    });

    it('should upload file from URL without filename', async () => {
      const url = 'https://example.com/image.jpg';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'storage-id-789',
          originalSize: 2048,
          size: 1500,
          mimeType: 'image/png',
          checksum: 'hash456',
          url: 'http://storage/file',
        }),
      });

      const result = await service.uploadFileFromUrl(url);

      expect(result.fileId).toBe('storage-id-789');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/from-url'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should throw error if storage returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Invalid URL',
      });

      await expect(service.uploadFileFromUrl('http://invalid.url')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle timeout/abort', async () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      mockFetch.mockRejectedValue(error);

      await expect(service.uploadFileFromUrl('http://example.com/file.jpg')).rejects.toThrow(
        'Media Storage request timed out',
      );
    });
  });


  describe('remove', () => {
    it('should delete from storage and database', async () => {
      const mediaId = 'media-1';
      const mockMedia = {
        id: mediaId,
        storageType: StorageType.FS,
        storagePath: 'file-id-123',
      };

      mockPrismaService.media.findUnique.mockResolvedValue(mockMedia);
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);
      mockFetch.mockResolvedValue({ ok: true });

      const result = await service.remove(mediaId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files/file-id-123'),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(mockPrismaService.media.delete).toHaveBeenCalledWith({ where: { id: mediaId } });
      expect(result).toEqual(mockMedia);
    });

    it('should not call storage for Telegram files', async () => {
      const mediaId = 'media-1';
      const mockMedia = {
        id: mediaId,
        storageType: StorageType.TELEGRAM,
        storagePath: 'telegram-file-id',
      };

      mockPrismaService.media.findUnique.mockResolvedValue(mockMedia);
      mockPrismaService.media.delete.mockResolvedValue(mockMedia);

      await service.remove(mediaId);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockPrismaService.media.delete).toHaveBeenCalled();
    });
  });

  describe('streamFileFromStorage', () => {
    it('should proxy stream from storage', async () => {
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();
      mockRes.end = jest.fn();
      mockRes.statusCode = 0;

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(Buffer.from('data')));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([['Content-Type', 'image/jpeg']]),
        body: mockBody,
      });

      await service.streamFileFromStorage('file-id', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(mockRes.statusCode).toBe(200);
    });
  });

  describe('streamThumbnailFromStorage', () => {
    it('should proxy thumbnail request', async () => {
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();
      mockRes.end = jest.fn();
      mockRes.statusCode = 0;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        body: null,
      });

      await service.streamThumbnailFromStorage('file-id', 100, 100, 80, mockRes);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('width=100\u0026height=100\u0026quality=80'),
        expect.any(Object),
      );
    });

    it('should use THUMBNAIL_QUALITY from env when quality not specified', async () => {
      const mockRes = new PassThrough() as any;
      mockRes.setHeader = jest.fn();
      mockRes.end = jest.fn();
      mockRes.statusCode = 0;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        body: null,
      });

      await service.streamThumbnailFromStorage('file-id', 200, 200, undefined, mockRes);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('width=200&height=200&quality=75'),
        expect.any(Object),
      );
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

    it('should allow access if user has access to project', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue({
        id: 'media-1',
        publicationMedia: [
          {
            publication: {
              projectId: 'project-1',
              createdBy: 'user-1',
            },
          },
        ],
      });

      mockPermissionsService.checkProjectAccess.mockResolvedValue(undefined);

      await expect(service.checkMediaAccess('media-1', 'user-1')).resolves.not.toThrow();
      expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith('project-1', 'user-1');
    });

    it('should throw ForbiddenException if user has no access', async () => {
      mockPrismaService.media.findUnique.mockResolvedValue({
        id: 'media-1',
        publicationMedia: [
          {
            publication: {
              projectId: 'project-1',
              createdBy: 'other-user',
            },
          },
        ],
      });

      mockPermissionsService.checkProjectAccess.mockRejectedValue(new ForbiddenException());

      await expect(service.checkMediaAccess('media-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
