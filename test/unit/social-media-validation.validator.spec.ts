import { describe, it, expect } from '@jest/globals';
import {
  getTextLength,
  normalizeOverrideContent,
  validatePostContent,
} from '../../src/common/validators/social-media-validation.validator.js';
import { SocialMedia } from '../../src/generated/prisma/index.js';

describe('social-media-validation.validator (unit)', () => {
  describe('normalizeOverrideContent', () => {
    it('returns undefined as-is', () => {
      expect(normalizeOverrideContent(undefined)).toBeUndefined();
    });

    it('returns null as-is', () => {
      expect(normalizeOverrideContent(null)).toBeNull();
    });

    it('treats empty string as no override', () => {
      expect(normalizeOverrideContent('')).toBeNull();
    });

    it('treats whitespace-only string as no override', () => {
      expect(normalizeOverrideContent('   \n\t  ')).toBeNull();
    });

    it('treats HTML-only string as no override', () => {
      expect(normalizeOverrideContent('<p><br></p>')).toBeNull();
    });

    it('keeps non-empty content', () => {
      expect(normalizeOverrideContent('Hello')).toBe('Hello');
    });
  });

  describe('getTextLength (Telegram-like)', () => {
    it('extracts plain text from markdown (formatting removed)', () => {
      expect(getTextLength('Hello **world**')).toBe('Hello world'.length);
    });

    it('ignores raw HTML inside markdown', () => {
      expect(getTextLength('Hello <b>world</b>')).toBe('Hello world'.length);
    });

    it('decodes HTML entities', () => {
      expect(getTextLength('A&nbsp;B &amp; C')).toBe('A B & C'.length);
    });

    it('decodes numeric HTML entities', () => {
      expect(getTextLength('Smile: &#128512;')).toBe('Smile: 😀'.length);
    });

    it('decodes hex HTML entities', () => {
      expect(getTextLength('Smile: &#x1F600;')).toBe('Smile: 😀'.length);
    });
  });

  describe('validatePostContent', () => {
    it('validates Telegram text length for text-only post', () => {
      const res = validatePostContent({
        socialMedia: SocialMedia.TELEGRAM,
        mediaCount: 0,
        content: 'a'.repeat(4097),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain('exceeds maximum allowed (4096)');
    });

    it('validates Telegram caption length when media is present', () => {
      const res = validatePostContent({
        socialMedia: SocialMedia.TELEGRAM,
        mediaCount: 1,
        content: 'a'.repeat(1025),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain('exceeds maximum allowed (1024)');
    });

    it('validates media count', () => {
      const res = validatePostContent({
        socialMedia: SocialMedia.TELEGRAM,
        mediaCount: 11,
        content: 'ok',
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain('Media count (11)');
    });
  });
});
