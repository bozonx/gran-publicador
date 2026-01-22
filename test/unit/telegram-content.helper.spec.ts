import { extractMedia } from '../../src/modules/telegram-bot/telegram-content.helper.js';
import { MediaType } from '../../src/generated/prisma/client.js';

describe('telegram-content.helper', () => {
  describe('extractMedia', () => {
    it('should extract hasSpoiler from photo message', () => {
      const message = {
        photo: [
          { file_id: 's1', file_size: 100, width: 90, height: 90 },
          { file_id: 's2', file_size: 200, width: 320, height: 320 },
          { file_id: 's3', file_size: 300, width: 800, height: 800 },
        ],
        has_media_spoiler: true,
      } as any;

      const media = extractMedia(message);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe(MediaType.IMAGE);
      expect(media[0].fileId).toBe('s3');
      expect(media[0].hasSpoiler).toBe(true);
    });

    it('should extract hasSpoiler from video message', () => {
      const message = {
        video: {
          file_id: 'v1',
          file_size: 1000,
          mime_type: 'video/mp4',
        },
        has_media_spoiler: true,
      } as any;

      const media = extractMedia(message);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe(MediaType.VIDEO);
      expect(media[0].hasSpoiler).toBe(true);
    });

    it('should default hasSpoiler to undefined if not present', () => {
      const message = {
        photo: [
          { file_id: 's1', file_size: 100, width: 90, height: 90 },
        ],
      } as any;

      const media = extractMedia(message);
      expect(media[0].hasSpoiler).toBeUndefined();
    });
  });
});
