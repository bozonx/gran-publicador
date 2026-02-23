import { describe, it, expect } from '@jest/globals';
import { parseTags, normalizeTags, formatTagsCsv } from '../../src/utils/tags.js';

describe('Tags Utils', () => {
  describe('parseTags', () => {
    it('should parse comma-separated string', () => {
      expect(parseTags('tag1, #tag2  , tag3')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle array input', () => {
      expect(parseTags(['tag1', '#tag2'])).toEqual(['tag1', 'tag2']);
    });

    it('should return empty array for invalid input', () => {
      expect(parseTags(null)).toEqual([]);
      expect(parseTags(undefined)).toEqual([]);
      expect(parseTags('')).toEqual([]);
    });

    it('should strip excessive hash characters', () => {
        expect(parseTags('###test')).toEqual(['test']);
    });
  });

  describe('normalizeTags', () => {
    it('should deduplicate tags case-insensitively by default', () => {
      expect(normalizeTags(['Tag1', 'tag1', 'TAG1'])).toEqual(['Tag1']);
    });

    it('should respect lowercase option', () => {
      expect(normalizeTags(['Tag1'], { lowercase: true })).toEqual(['tag1']);
    });

    it('should respect limit option', () => {
      expect(normalizeTags(['a', 'b', 'c'], { limit: 2 })).toEqual(['a', 'b']);
    });

    it('should handle empty input', () => {
      expect(normalizeTags([])).toEqual([]);
    });
  });

  describe('formatTagsCsv', () => {
    it('should join with comma and space', () => {
      expect(formatTagsCsv(['a', 'b'])).toBe('a, b');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatTagsCsv(null)).toBe('');
    });
  });
});
