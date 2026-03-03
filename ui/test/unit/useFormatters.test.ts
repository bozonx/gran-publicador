import { describe, expect, it, vi } from 'vitest';
import { useFormatters } from '../../app/composables/useFormatters';

describe('composables/useFormatters', () => {
  const { 
    formatDateShort, 
    formatDateWithTime, 
    formatDateWithSeconds, 
    truncateContent, 
    formatNumber, 
    getPublicationDisplayTitle 
  } = useFormatters();

  describe('formatDateShort', () => {
    it('returns em-dash for null/undefined', () => {
      expect(formatDateShort(null)).toBe('—');
      expect(formatDateShort(undefined)).toBe('—');
    });

    it('returns em-dash for invalid date strings', () => {
      expect(formatDateShort('not-a-date')).toBe('—');
    });

    it('delegates to i18n formatter', () => {
      const date = '2025-01-01T12:00:00.000Z';
      expect(formatDateShort(date)).toBe(`${date}|short`);
    });
  });

  describe('formatDateWithTime', () => {
    it('returns em-dash for null/undefined', () => {
      expect(formatDateWithTime(null)).toBe('—');
    });

    it('delegates to i18n formatter with options object', () => {
      const date = '2025-01-01T12:00:00.000Z';
      const result = formatDateWithTime(date);
      expect(result).toContain(date);
      expect(result).toContain('year');
      expect(result).toContain('month');
    });
  });

  describe('truncateContent', () => {
    it('returns empty string for null/undefined', () => {
      expect(truncateContent(null)).toBe('');
    });

    it('strips HTML tags and truncates', () => {
      const html = '<p>Hello <b>World</b>!</p>';
      expect(truncateContent(html, 5)).toBe('Hello...');
    });

    it('returns full text if within limit', () => {
      expect(truncateContent('Hello', 10)).toBe('Hello');
    });
  });

  describe('formatNumber', () => {
    it('returns 0 for null/undefined', () => {
      expect(formatNumber(null)).toEqual('0');
      expect(formatNumber(undefined)).toEqual('0');
    });

    it('formats number using toLocaleString', () => {
      const num = 1234567.89;
      // In tests it might stay as is or use locale
      expect(formatNumber(num)).toEqual(num.toLocaleString());
    });
  });

  describe('getPublicationDisplayTitle', () => {
    it('uses title if available', () => {
      const pub = { title: '<p>  My Title  </p>', content: 'Some content' };
      expect(getPublicationDisplayTitle(pub)).toBe('My Title');
    });

    it('uses content if title is missing', () => {
      const pub = { title: null, content: 'Some content <b>here</b>' };
      expect(getPublicationDisplayTitle(pub)).toBe('Some content here');
    });

    it('uses tags if title and content are missing', () => {
      const pub = { tags: ['tag1', 'tag2'] };
      expect(getPublicationDisplayTitle(pub)).toBe('tag1, tag2');
    });

    it('uses single tag string if available', () => {
       const pub = { tags: 'tag1' };
       expect(getPublicationDisplayTitle(pub)).toBe('tag1');
    });

    it('uses createdAt as fallback', () => {
      const pub = { createdAt: '2025-01-01T12:00:00.000Z' };
      const display = getPublicationDisplayTitle(pub);
      expect(display).toContain('2025');
      expect(display).toContain('short');
    });

    it('returns Untitled if everything is missing', () => {
      expect(getPublicationDisplayTitle({})).toBe('Untitled');
    });

    it('handles tags being a string gracefully', () => {
      const pub = { tags: '  my tag  ' };
      expect(getPublicationDisplayTitle(pub)).toBe('my tag');
    });
  });
});
