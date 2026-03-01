import { describe, it, expect, vi } from 'vitest';
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation';
import { SocialMedia, PostType, MediaType } from '@gran/shared/social-media-platforms';

// Mock vue-i18n directly
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => key + (params ? JSON.stringify(params) : ''),
  }),
}));

// Mock #imports just in case
vi.mock('#imports', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => key + (params ? JSON.stringify(params) : ''),
  }),
}));

describe('useSocialMediaValidation', () => {
  const { 
    getContentLength, 
    validatePostContent, 
    getRemainingCharacters 
  } = useSocialMediaValidation();

  describe('getContentLength', () => {
    it('strips simple HTML tags', () => {
      expect(getContentLength('<p>Hello</p>')).toBe(5);
    });

    it('strips complex HTML tags', () => {
      expect(getContentLength('<div class="foo">Hello <span style="color: red">World</span></div>')).toBe(11);
    });

    it('decodes HTML entities', () => {
      expect(getContentLength('A &amp; B')).toBe(5);
    });

    it('handles markdown correctly', () => {
      // Markdown title "# Title" becomes "Title" (depending on unist-util-to-string)
      // Actually it might keep the newline if not trimmed.
      const length = getContentLength('# Title');
      expect(length).toBe(5);
    });
  });

  describe('validatePostContent', () => {
    it('returns valid for correct Telegram post', () => {
      const result = validatePostContent('Hello', 0, SocialMedia.TELEGRAM, [], PostType.POST);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects text too long for Telegram (text-only)', () => {
      const longText = 'a'.repeat(4097);
      const result = validatePostContent(longText, 0, SocialMedia.TELEGRAM, [], PostType.POST);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'content')).toBe(true);
    });

    it('detects caption too long for Telegram (with media)', () => {
      const longText = 'a'.repeat(1025);
      const result = validatePostContent(longText, 1, SocialMedia.TELEGRAM, [{ type: MediaType.IMAGE } as any], PostType.POST);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'content')).toBe(true);
    });

    it('validates maximum media count for Telegram', () => {
      const result = validatePostContent('', 11, SocialMedia.TELEGRAM, [], PostType.POST);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'media')).toBe(true);
    });

    it('validates allowed media types for Telegram ARTICLE', () => {
      // Telegram ARTICLE only allows IMAGE (as cover) according to constants
      const result = validatePostContent('', 1, SocialMedia.TELEGRAM, [{ type: MediaType.VIDEO } as any], PostType.ARTICLE);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'media')).toBe(true);
    });
    
    it('validates gallery constraints', () => {
        // Telegram gallery allows VISUAL_MEDIA_TYPES (IMAGE, VIDEO)
        // AUDIO not allowed in gallery
        const result = validatePostContent('', 2, SocialMedia.TELEGRAM, [{ type: MediaType.IMAGE } as any, { type: MediaType.AUDIO } as any], PostType.POST);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'media')).toBe(true);
    });

    it('validates tags count', () => {
        const tags = Array(16).fill('tag');
        const result = validatePostContent('', 0, SocialMedia.TELEGRAM, [], PostType.POST, tags);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'tags')).toBe(true);
    });
  });

  describe('getRemainingCharacters', () => {
    it('calculates remaining chars for Telegram text post', () => {
      // max 4096
      expect(getRemainingCharacters('hello', 0, SocialMedia.TELEGRAM)).toBe(4091);
    });

    it('calculates remaining chars for Telegram caption', () => {
      // max 1024
      expect(getRemainingCharacters('hello', 1, SocialMedia.TELEGRAM)).toBe(1019);
    });
  });
});
