import { SocialPostingRequestFormatter } from '../../src/modules/social-posting/utils/social-posting-request.formatter.js';
import {
  PostType,
  SocialMedia,
  MediaType,
  StorageType,
} from '../../src/generated/prisma/client.js';

describe('SocialPostingRequestFormatter', () => {
  const mockPost = {
    id: 'post-123',
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    content: null,
    tags: null,
    language: 'ru-RU',
  };

  const mockChannel = {
    socialMedia: SocialMedia.TELEGRAM,
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

  const params = {
    post: mockPost,
    channel: mockChannel,
    publication: mockPublication,
    apiKey: 'secret-token',
    targetChannelId: '@test_channel',
    mediaDir: '/tmp',
  };

  it('should format request correctly for Telegram', () => {
    const request = SocialPostingRequestFormatter.prepareRequest(params);

    expect(request.platform).toBe('telegram');
    expect(request.bodyFormat).toBe('md');
    expect(request.title).toBeUndefined();
    expect(request.description).toBeUndefined();
    expect((request as any).tags).toBeUndefined();
    expect(request.body).toContain('Pub Content');
    expect(request.body).toContain('#tag1');
    expect(request.idempotencyKey).toBeDefined();
    expect(request.postLanguage).toBe('ru-RU');
  });

  it('should format request correctly for non-Telegram platforms', () => {
    const vkParams = {
      ...params,
      channel: { ...mockChannel, socialMedia: SocialMedia.VK },
    };
    const request = SocialPostingRequestFormatter.prepareRequest(vkParams);

    expect(request.platform).toBe('vk');
    expect(request.bodyFormat).toBe('html');
    expect(request.title).toBe('Pub Title');
    expect(request.description).toBe('Pub Desc');
  });

  it('should handle platformOptions disableNotification', () => {
    const paramsWithOpts = {
      ...params,
      post: {
        ...mockPost,
        platformOptions: { disableNotification: true },
      },
    };
    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithOpts);
    expect(request.disableNotification).toBe(true);
  });

  it('should handle single media mapping', () => {
    const paramsWithMedia = {
      ...params,
      publication: {
        ...mockPublication,
        media: [
          {
            media: {
              type: MediaType.IMAGE,
              storageType: StorageType.TELEGRAM,
              storagePath: 'file_id_123',
            },
          },
        ],
      },
    };

    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithMedia);
    expect(request.cover).toEqual({ src: 'file_id_123' });
    expect(request.media).toBeUndefined();
  });

  it('should handle multiple media mapping', () => {
    const paramsWithMultiMedia = {
      ...params,
      publication: {
        ...mockPublication,
        media: [
          {
            media: {
              type: MediaType.IMAGE,
              storageType: StorageType.TELEGRAM,
              storagePath: 'file_id_1',
            },
          },
          {
            media: {
              type: MediaType.VIDEO,
              storageType: StorageType.FS,
              storagePath: 'https://example.com/video.mp4',
            },
          },
        ],
      },
    };

    const request = SocialPostingRequestFormatter.prepareRequest(paramsWithMultiMedia);
    expect(request.cover).toBeUndefined();
    expect(request.media).toHaveLength(2);
    expect(request.media![0]).toEqual({ type: 'image', src: 'file_id_1' });
    expect(request.media![1]).toEqual({ type: 'video', src: 'https://example.com/video.mp4' });
  });
});
