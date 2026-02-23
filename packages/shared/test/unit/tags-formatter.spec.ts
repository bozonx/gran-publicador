import { describe, it, expect } from '@jest/globals';
import { TagsFormatter } from '../../src/social-posting/tags-formatter.js';

describe('TagsFormatter', () => {
  describe('toArray', () => {
    it('should return an empty array for null or undefined', () => {
      expect(TagsFormatter.toArray(null)).toEqual([]);
      expect(TagsFormatter.toArray(undefined)).toEqual([]);
    });

    it('should return an empty array for empty strings', () => {
      expect(TagsFormatter.toArray('')).toEqual([]);
      expect(TagsFormatter.toArray('  ')).toEqual([]);
    });

    it('should split tags by comma and trim whitespace', () => {
      expect(TagsFormatter.toArray('tag1, tag2 ,tag3')).toEqual(['#tag1', '#tag2', '#tag3']);
    });

    it('should remove existing # prefix before processing', () => {
      expect(TagsFormatter.toArray('#tag1, ##tag2')).toEqual(['#tag1', '##tag2']); // Note: slice(1) only removes one '#'
    });

    it('should handle array of strings', () => {
      expect(TagsFormatter.toArray(['tag1', 'tag2'])).toEqual(['#tag1', '#tag2']);
    });

    it('should convert cases correctly', () => {
      const complexTag = 'SimpleTag-Example_here';
      
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'snake_case' })).toEqual(['#simple_tag_example_here']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'SNAKE_CASE' })).toEqual(['#SIMPLE_TAG_EXAMPLE_HERE']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'camelCase' })).toEqual(['#simpleTagExampleHere']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'pascalCase' })).toEqual(['#SimpleTagExampleHere']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'kebab-case' })).toEqual(['#simple-tag-example-here']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'KEBAB-CASE' })).toEqual(['#SIMPLE-TAG-EXAMPLE-HERE']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'lower_case' })).toEqual(['#simple tag example here']);
      expect(TagsFormatter.toArray(complexTag, { tagCase: 'upper_case' })).toEqual(['#SIMPLE TAG EXAMPLE HERE']);
    });

    it('should return input as is if case is none', () => {
      expect(TagsFormatter.toArray('SimpleTag', { tagCase: 'none' })).toEqual(['#SimpleTag']);
    });
  });

  describe('format', () => {
    it('should join tags with space', () => {
      expect(TagsFormatter.format('tag1, tag2')).toBe('#tag1 #tag2');
    });

    it('should return empty string for no tags', () => {
      expect(TagsFormatter.format('')).toBe('');
    });
  });
});
