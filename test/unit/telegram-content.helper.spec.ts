import {
  extractMedia,
  extractText,
} from '../../src/modules/telegram-bot/telegram-content.helper.js';
import { MediaType } from '../../src/generated/prisma/index.js';

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
        photo: [{ file_id: 's1', file_size: 100, width: 90, height: 90 }],
      } as any;

      const media = extractMedia(message);
      expect(media[0].hasSpoiler).toBeUndefined();
    });

    it('should extract isVoice: true from voice message', () => {
      const message = {
        voice: {
          file_id: 'v1',
          file_size: 500,
          mime_type: 'audio/ogg',
        },
      } as any;

      const media = extractMedia(message);
      expect(media).toHaveLength(1);
      expect(media[0].type).toBe(MediaType.AUDIO);
      expect(media[0].fileId).toBe('v1');
      expect(media[0].isVoice).toBe(true);
    });
  });

  describe('extractText', () => {
    it('should extract plain text when no entities are present', () => {
      const message = {
        text: 'Hello world',
      } as any;
      expect(extractText(message)).toBe('Hello world');
    });

    it('should extract bold text', () => {
      const message = {
        text: 'Hello world',
        entities: [{ offset: 0, length: 5, type: 'bold' }],
      } as any;
      expect(extractText(message)).toBe('**Hello** world');
    });

    it('should extract italic text', () => {
      const message = {
        text: 'Hello world',
        entities: [{ offset: 6, length: 5, type: 'italic' }],
      } as any;
      expect(extractText(message)).toBe('Hello _world_');
    });

    it('should extract link', () => {
      const message = {
        text: 'Check this out',
        entities: [{ offset: 6, length: 4, type: 'text_link', url: 'https://example.com' }],
      } as any;
      expect(extractText(message)).toBe('Check [this](https://example.com) out');
    });

    it('should handle nested entities', () => {
      const message = {
        text: 'Bold and italic',
        entities: [
          { offset: 0, length: 15, type: 'bold' },
          { offset: 9, length: 6, type: 'italic' },
        ],
      } as any;
      expect(extractText(message)).toBe('**Bold and _italic_**');
    });

    it('should handle multi-byte characters (emoji)', () => {
      const message = {
        text: '🚀 Space is cool',
        entities: [
          { offset: 3, length: 5, type: 'bold' }, // 'Space' starts after '🚀 ' (3 code units)
        ],
      } as any;
      expect(extractText(message)).toBe('🚀 **Space** is cool');
    });

    it('should handle multiple sequential entities', () => {
      const message = {
        text: 'First Second Third',
        entities: [
          { offset: 0, length: 5, type: 'bold' },
          { offset: 6, length: 6, type: 'italic' },
          { offset: 13, length: 5, type: 'underline' },
        ],
      } as any;
      expect(extractText(message)).toBe('**First** _Second_ <u>Third</u>');
    });

    it('should handle code and pre', () => {
      const message = {
        text: 'const x = 10; console.log(x);',
        entities: [
          { offset: 0, length: 13, type: 'code' },
          { offset: 14, length: 15, type: 'pre', language: 'javascript' },
        ],
      } as any;
      expect(extractText(message)).toBe('`const x = 10;` ```javascript\nconsole.log(x);\n```');
    });

    it('should handle blockquote', () => {
      const message = {
        text: 'To be or not to be',
        entities: [{ offset: 0, length: 18, type: 'blockquote' }],
      } as any;
      expect(extractText(message)).toBe('> To be or not to be');
    });

    it('should handle expandable_blockquote', () => {
      const message = {
        text: 'Expandable quote',
        entities: [{ offset: 0, length: 16, type: 'expandable_blockquote' }],
      } as any;
      expect(extractText(message)).toBe('> Expandable quote');
    });

    it('should handle spoiler', () => {
      const message = {
        text: 'Secret',
        entities: [{ offset: 0, length: 6, type: 'spoiler' }],
      } as any;
      expect(extractText(message)).toBe('||Secret||');
    });
  });
});
