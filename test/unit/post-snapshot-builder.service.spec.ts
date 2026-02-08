import { Test, type TestingModule } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { PostSnapshotBuilderService } from '../../src/modules/social-posting/post-snapshot-builder.service.js';
import { PrismaService } from '../../src/modules/prisma/prisma.service.js';
import { POSTING_SNAPSHOT_VERSION } from '../../src/modules/social-posting/interfaces/posting-snapshot.interface.js';

describe('PostSnapshotBuilderService', () => {
  let service: PostSnapshotBuilderService;

  const mockPrismaService = {
    publication: {
      findUnique: jest.fn() as any,
    },
    post: {
      findMany: jest.fn() as any,
      update: jest.fn() as any,
      updateMany: jest.fn() as any,
    },
    projectTemplate: {
      findMany: jest.fn() as any,
    },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostSnapshotBuilderService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PostSnapshotBuilderService>(PostSnapshotBuilderService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildForPublication', () => {
    it('should build snapshots for all posts of a publication', async () => {
      const publicationId = 'pub-1';

      mockPrismaService.publication.findUnique.mockResolvedValue({
        id: publicationId,
        projectId: 'proj-1',
        title: 'Test Title',
        content: 'Test content',
        tags: 'tag1, tag2',
        authorComment: 'Author note',
        postType: 'POST',
        language: 'ru-RU',
        media: [
          {
            order: 0,
            hasSpoiler: false,
            media: {
              id: 'media-1',
              type: 'IMAGE',
              storageType: 'TELEGRAM',
              storagePath: 'file_id_123',
              meta: {},
            },
          },
        ],
      });

      mockPrismaService.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: null,
          tags: null,
          language: null,
          template: null,
          authorSignature: 'Author Sig',
          channel: {
            socialMedia: 'TELEGRAM',
            language: 'ru-RU',
            preferences: {},
          },
        },
        {
          id: 'post-2',
          content: 'Override content',
          tags: 'custom-tag',
          language: 'en-US',
          template: null,
          authorSignature: null,
          channel: {
            socialMedia: 'VK',
            language: 'en-US',
            preferences: {},
          },
        },
      ]);

      mockPrismaService.projectTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.post.update.mockResolvedValue({});

      await service.buildForPublication(publicationId);

      expect(mockPrismaService.post.update).toHaveBeenCalledTimes(2);

      // Verify first post snapshot
      const firstCall = mockPrismaService.post.update.mock.calls[0];
      expect(firstCall[0].where).toEqual({ id: 'post-1' });
      const snapshot1 = firstCall[0].data.postingSnapshot;
      expect(snapshot1.version).toBe(POSTING_SNAPSHOT_VERSION);
      expect(typeof snapshot1.body).toBe('string');
      expect(snapshot1.body.length).toBeGreaterThan(0);
      expect(snapshot1.media).toHaveLength(1);
      expect(snapshot1.media[0]).toEqual({
        mediaId: 'media-1',
        type: 'IMAGE',
        storageType: 'TELEGRAM',
        storagePath: 'file_id_123',
        order: 0,
        hasSpoiler: false,
        meta: {},
      });
      expect(firstCall[0].data.postingSnapshotCreatedAt).toBeInstanceOf(Date);

      // Verify second post snapshot
      const secondCall = mockPrismaService.post.update.mock.calls[1];
      expect(secondCall[0].where).toEqual({ id: 'post-2' });
      const snapshot2 = secondCall[0].data.postingSnapshot;
      expect(snapshot2.version).toBe(POSTING_SNAPSHOT_VERSION);
      expect(snapshot2.body).toContain('Override content');
    });

    it('should skip if publication not found', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue(null);

      await service.buildForPublication('non-existent');

      expect(mockPrismaService.post.findMany).not.toHaveBeenCalled();
      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('should skip if no posts exist', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({
        id: 'pub-1',
        projectId: 'proj-1',
        content: 'Some content',
        media: [],
      });
      mockPrismaService.post.findMany.mockResolvedValue([]);

      await service.buildForPublication('pub-1');

      expect(mockPrismaService.post.update).not.toHaveBeenCalled();
    });

    it('should build snapshot with empty media when publication has no media', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({
        id: 'pub-1',
        projectId: 'proj-1',
        content: 'Text only',
        media: [],
      });

      mockPrismaService.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: null,
          tags: null,
          language: null,
          template: null,
          authorSignature: null,
          channel: {
            socialMedia: 'TELEGRAM',
            language: 'ru-RU',
            preferences: {},
          },
        },
      ]);

      mockPrismaService.projectTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.post.update.mockResolvedValue({});

      await service.buildForPublication('pub-1');

      const snapshot = mockPrismaService.post.update.mock.calls[0][0].data.postingSnapshot;
      expect(snapshot.media).toEqual([]);
      expect(snapshot.version).toBe(POSTING_SNAPSHOT_VERSION);
    });

    it('should apply Telegram HTML conversion for Telegram channels', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({
        id: 'pub-1',
        projectId: 'proj-1',
        content: '**bold text**',
        media: [],
      });

      mockPrismaService.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: null,
          tags: null,
          language: null,
          template: null,
          authorSignature: null,
          channel: {
            socialMedia: 'TELEGRAM',
            language: 'ru-RU',
            preferences: {},
          },
        },
      ]);

      mockPrismaService.projectTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.post.update.mockResolvedValue({});

      await service.buildForPublication('pub-1');

      const snapshot = mockPrismaService.post.update.mock.calls[0][0].data.postingSnapshot;
      // Telegram body should be HTML-converted (bold -> <b>)
      expect(snapshot.body).toContain('<b>');
    });

    it('should NOT apply Telegram HTML conversion for non-Telegram channels', async () => {
      mockPrismaService.publication.findUnique.mockResolvedValue({
        id: 'pub-1',
        projectId: 'proj-1',
        content: '**bold text**',
        media: [],
      });

      mockPrismaService.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: null,
          tags: null,
          language: null,
          template: null,
          authorSignature: null,
          channel: {
            socialMedia: 'VK',
            language: 'ru-RU',
            preferences: {},
          },
        },
      ]);

      mockPrismaService.projectTemplate.findMany.mockResolvedValue([]);
      mockPrismaService.post.update.mockResolvedValue({});

      await service.buildForPublication('pub-1');

      const snapshot = mockPrismaService.post.update.mock.calls[0][0].data.postingSnapshot;
      // Non-Telegram body should keep markdown as-is
      expect(snapshot.body).not.toContain('<b>');
      expect(snapshot.body).toContain('**bold text**');
    });
  });

  describe('clearForPublication', () => {
    it('should clear snapshots for all posts of a publication', async () => {
      mockPrismaService.post.updateMany.mockResolvedValue({ count: 3 });

      await service.clearForPublication('pub-1');

      expect(mockPrismaService.post.updateMany).toHaveBeenCalledWith({
        where: { publicationId: 'pub-1' },
        data: {
          postingSnapshot: null,
          postingSnapshotCreatedAt: null,
        },
      });
    });
  });
});
