import { describe, it, expect } from '@jest/globals';
import {
  getTextLength,
  normalizeOverrideContent,
  validatePostContent,
} from '../../src/common/validators/social-media-validation.validator.js';
import { PostType, SocialMedia } from '../../src/generated/prisma/index.js';
import { getValidationRulesOrThrow } from '../../src/common/validators/social-media-validation.constants.js';

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
      const rules = getValidationRulesOrThrow(SocialMedia.telegram, PostType.POST);
      const res = validatePostContent({
        socialMedia: SocialMedia.telegram,
        postType: PostType.POST,
        mediaCount: 0,
        content: 'a'.repeat(rules.maxTextLength + 1),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain(`exceeds maximum allowed (${rules.maxTextLength})`);
    });

    it('validates Telegram caption length when media is present', () => {
      const rules = getValidationRulesOrThrow(SocialMedia.telegram, PostType.POST);
      const res = validatePostContent({
        socialMedia: SocialMedia.telegram,
        postType: PostType.POST,
        mediaCount: 1,
        content: 'a'.repeat(rules.maxCaptionLength + 1),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain(`exceeds maximum allowed (${rules.maxCaptionLength})`);
    });

    it('validates media count', () => {
      const rules = getValidationRulesOrThrow(SocialMedia.telegram, PostType.POST);
      const res = validatePostContent({
        socialMedia: SocialMedia.telegram,
        postType: PostType.POST,
        mediaCount: rules.maxMediaCount + 1,
        content: 'ok',
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain(`Media count (${rules.maxMediaCount + 1})`);
    });

    it('validates VK text length for text-only post', () => {
      const rules = getValidationRulesOrThrow(SocialMedia.vk, PostType.POST);
      const res = validatePostContent({
        socialMedia: SocialMedia.vk,
        postType: PostType.POST,
        mediaCount: 0,
        content: 'a'.repeat(rules.maxTextLength + 1),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain(`exceeds maximum allowed (${rules.maxTextLength})`);
    });

    it('validates SITE text length for ARTICLE', () => {
      const rules = getValidationRulesOrThrow(SocialMedia.site, PostType.ARTICLE);
      const res = validatePostContent({
        socialMedia: SocialMedia.site,
        postType: PostType.ARTICLE,
        mediaCount: 0,
        content: 'a'.repeat(rules.maxTextLength + 1),
      });
      expect(res.isValid).toBe(false);
      expect(res.errors.join(' ')).toContain(`exceeds maximum allowed (${rules.maxTextLength})`);
    });
  });
});
