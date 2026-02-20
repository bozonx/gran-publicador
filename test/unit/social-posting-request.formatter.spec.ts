import { SocialPostingRequestFormatter } from '../../src/modules/social-posting/utils/social-posting-request.formatter.js';
import { PostType, SocialMedia } from '../../src/generated/prisma/index.js';
import type { PostingSnapshot } from '../../src/modules/social-posting/interfaces/posting-snapshot.interface.js';
import { describe, it, expect } from '@jest/globals';

describe('SocialPostingRequestFormatter', () => {
  const mockPost = {
    id: 'post-123',
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    content: null,
    tags: 'tag1',
    language: 'ru-RU',
  };

  const mockChannel = {
    socialMedia: SocialMedia.telegram,
    language: 'ru-RU',
    preferences: {},
  };

  const mockPublication = {
    title: 'Pub Title',
    content: 'Pub Content',
    description: 'Pub Desc',
    tags: 'tag1',
    postType: PostType.POST,
    language: 'ru-RU',
    media: [],
  };

  const mockSnapshot: PostingSnapshot = {
    version: 1,
    body: 'Rendered body with #tag1',
    media: [],
  };

  const params = {
    post: mockPost,
    channel: mockChannel,
    publication: mockPublication,
    apiKey: 'secret-token',
    targetChannelId: '@test_channel',
    mediaStorageUrl: 'http://media-storage/api/v1',
    snapshot: mockSnapshot,
  };

  it('should format request correctly for Telegram using snapshot body', () => {
    const request = SocialPostingRequestFormatter.prepareRequest(params);

    expect(request.platform).toBe('telegram');
    expect(request.bodyFormat).toBe('html');
    expect(request.title).toBeUndefined();
    expect(request.description).toBeUndefined();
    expect((request as any).tags).toBeUndefined();
    expect(request.body).toBe('Rendered body with #tag1');
    expect(request.idempotencyKey).toBeDefined();
    expect(request.postLanguage).toBe('ru-RU');
  });

  it('should format request correctly for non-Telegram platforms', () => {
    const vkParams = {
      ...params,
      channel: { ...mockChannel, socialMedia: SocialMedia.vk },
    };
    const request = SocialPostingRequestFormatter.prepareRequest(vkParams);

    expect(request.platform).toBe('vk');
    expect(request.bodyFormat).toBe('markdown');
    expect(request.title).toBe('Pub Title');
    expect(request.description).toBe('Pub Desc');
  });

  it('should handle platformOptions disableNotification', () => {
    const paramsWithNamespacedOpts = {
      ...params,
      post: {
        ...mockPost,
        platformOptions: { telegram: { disableNotification: true } },
      },
    };
    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithNamespacedOpts);
    expect(request.disableNotification).toBe(true);
  });

  it('should forward telegram show_caption_above_media into request.options', () => {
    const paramsWithTelegramOptions = {
      ...params,
      post: {
        ...mockPost,
        platformOptions: { telegram: { show_caption_above_media: true } },
      },
    };
    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithTelegramOptions);
    expect(request.options?.show_caption_above_media).toBe(true);
  });

  it('should handle single snapshot media mapping', () => {
    const paramsWithMedia = {
      ...params,
      snapshot: {
        ...mockSnapshot,
        media: [
          {
            mediaId: 'media-1',
            type: 'IMAGE',
            storageType: 'TELEGRAM',
            storagePath: 'file_id_123',
            order: 0,
            hasSpoiler: false,
            meta: {},
          },
        ],
      },
    };

    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithMedia);
    expect(request.cover).toEqual({ src: 'file_id_123', hasSpoiler: false });
    expect(request.media).toBeUndefined();
  });

  it('should handle single FS snapshot media mapping with URL generation', () => {
    const paramsWithMedia = {
      ...params,
      snapshot: {
        ...mockSnapshot,
        media: [
          {
            mediaId: 'media-1',
            type: 'IMAGE',
            storageType: 'FS',
            storagePath: 'file-123',
            order: 0,
            hasSpoiler: false,
            meta: {},
          },
        ],
      },
    };

    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithMedia);
    expect(request.cover).toEqual({
      src: 'http://media-storage/api/v1/files/file-123/download',
      hasSpoiler: false,
    });
  });

  it('should handle multiple snapshot media mapping', () => {
    const paramsWithMultiMedia = {
      ...params,
      snapshot: {
        ...mockSnapshot,
        media: [
          {
            mediaId: 'media-1',
            type: 'IMAGE',
            storageType: 'TELEGRAM',
            storagePath: 'file_id_1',
            order: 0,
            hasSpoiler: false,
            meta: {},
          },
          {
            mediaId: 'media-2',
            type: 'VIDEO',
            storageType: 'FS',
            storagePath: 'file-abc',
            order: 1,
            hasSpoiler: false,
            meta: {},
          },
        ],
      },
    };

    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithMultiMedia);
    expect(request.cover).toBeUndefined();
    expect(request.media).toHaveLength(2);
    expect(request.media![0]).toEqual({ type: 'image', src: 'file_id_1', hasSpoiler: false });
    expect(request.media![1]).toEqual({
      type: 'video',
      src: 'http://media-storage/api/v1/files/file-abc/download',
      hasSpoiler: false,
    });
  });
});
