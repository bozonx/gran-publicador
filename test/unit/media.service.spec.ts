import { Test, type TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
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

  async function readWebBodyToString(body: unknown): Promise<string> {
    if (!body) {
      return '';
    }

    // uploadFileToStorage sends Readable.toWeb(multipartStream)
    const stream = body as ReadableStream<Uint8Array>;
    if (typeof (stream as any).getReader !== 'function') {
      return '';
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }

    return new TextDecoder().decode(merged);
  }

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
      const stream = Readable.from([buffer]);
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

      const result = await service.uploadFileToStorage(stream, filename, mimetype);

      expect(result.fileId).toBe('storage-id-123');
      expect(result.metadata.checksum).toBe('hash');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(Object),
        }),
      );
    });

    it('should pass compression options as optimize field', async () => {
      const buffer = Buffer.from('image-data');
      const stream = Readable.from([buffer]);
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

      await service.uploadFileToStorage(stream, filename, mimetype, 'user-1', 'avatar', {
        format: 'webp',
        quality: 85,
        maxDimension: 3840,
      });

      const callArgs = mockFetch.mock.calls[0];
      const options = callArgs[1];

      const bodyText = await readWebBodyToString(options.body);
      expect(bodyText).toContain('name="optimize"');
      expect(bodyText).toContain('"format":"webp"');
      expect(bodyText).toContain('"quality":85');
      expect(bodyText).toContain('"maxDimension":3840');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/files'),
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    it('should pass userId, purpose, and appId', async () => {
      const buffer = Buffer.from('test');
      const stream = Readable.from([buffer]);
      const filename = 'test.txt';
      const mimetype = 'text/plain';
      const userId = 'user-123';
      const purpose = 'avatar';

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

      await service.uploadFileToStorage(stream, filename, mimetype, userId, purpose);

      const callArgs = mockFetch.mock.calls[0];
      const options = callArgs[1];
      const bodyText = await readWebBodyToString(options.body);

      expect(bodyText).toContain('name="appId"');
      expect(bodyText).toContain('gran-publicador');
      expect(bodyText).toContain('name="userId"');
      expect(bodyText).toContain(userId);
      expect(bodyText).toContain('name="purpose"');
      expect(bodyText).toContain(purpose);
    });

    it('should throw error if storage returns non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Error message',
      });

      await expect(
        service.uploadFileToStorage(Readable.from([Buffer.from('')]), 'f', 'm'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if file is too large', async () => {
      const originalMaxFileSize = (service as any).maxFileSize;
      (service as any).maxFileSize = 0; // Force file to be too large

      mockFetch.mockImplementation(async (_url: string, options: any) => {
        // Read the body to trigger stream errors (like file too large)
        if (options?.body) {
          try {
            const stream = options.body;
            // Handle both Web Streams and Node Streams
            if (typeof stream.getReader === 'function') {
              const reader = stream.getReader();
              while (true) {
                const { done } = await reader.read();
                if (done) break;
              }
            } else if (typeof stream[Symbol.asyncIterator] === 'function') {
              for await (const _chunk of stream) { /* consume */ }
            }
          } catch (e) {
            throw e;
          }
        }
 
        return {
          ok: true,
          json: async () => ({
            id: 'storage-id-123',
            originalSize: 4,
            size: 4,
            mimeType: 'text/plain',
            checksum: 'hash',
            url: 'http://storage/file',
          }),
        };
      });

      await expect(
        service.uploadFileToStorage(Readable.from([Buffer.from('test')]), 'f', 'm'),
      ).rejects.toThrow(BadRequestException);

      (service as any).maxFileSize = originalMaxFileSize;
    });

    it('should handle timeout/abort', async () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      mockFetch.mockRejectedValue(error);

      await expect(
        service.uploadFileToStorage(Readable.from([Buffer.from('')]), 'f', 'm'),
      ).rejects.toThrow('Media Storage microservice request timed out');
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

      const optimize = {
        format: 'webp',
        maxDimension: 3840,
        quality: 85,
      };

      const result = await service.uploadFileFromUrl(url, filename, undefined, undefined, optimize);

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

      // Verify compression parameters are in the optimize field
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.url).toBe(url);
      expect(body.filename).toBe(filename);
      expect(body.optimize).toEqual(optimize);
    });

    it('should pass userId, purpose, and appId in body', async () => {
      const url = 'https://example.com/image.jpg';
      const filename = 'image.jpg';
      const userId = 'user-123';
      const purpose = 'avatar';

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

      await service.uploadFileFromUrl(url, filename, userId, purpose);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);

      expect(body.appId).toBe('gran-publicador');
      expect(body.userId).toBe(userId);
      expect(body.purpose).toBe(purpose);
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
        BadRequestException,
      );
    });

    it('should handle timeout/abort', async () => {
      const error = new Error('AbortError');
      error.name = 'AbortError';
      mockFetch.mockRejectedValue(error);

      await expect(service.uploadFileFromUrl('http://example.com/file.jpg')).rejects.toThrow(
        'Media Storage microservice request timed out',
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

  describe('getFileStream', () => {
    it('should proxy stream from storage', async () => {
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

      const result = await service.getFileStream('file-id');

      expect(result.headers['Content-Type']).toBe('image/jpeg');
      expect(result.status).toBe(200);
      expect(result.stream).toBeDefined();
    });
  });

  describe('getThumbnailStream', () => {
    it('should proxy thumbnail request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        body: new ReadableStream(),
      });

      await service.getThumbnailStream('file-id', 100, 100, 80);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('width=100\u0026height=100\u0026quality=80'),
        expect.any(Object),
      );
    });

    it('should use THUMBNAIL_QUALITY from env when quality not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map(),
        body: new ReadableStream(),
      });

      await service.getThumbnailStream('file-id', 200, 200, undefined);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('width=200\u0026height=200\u0026quality=75'),
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

      await expect(service.checkMediaAccess('media-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
