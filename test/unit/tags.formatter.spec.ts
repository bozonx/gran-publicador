import { TagsFormatter } from '../../src/modules/social-posting/utils/tags.formatter.js';

describe('TagsFormatter', () => {
  it('should format simple tags as hashtags', () => {
    const result = TagsFormatter.format('tag1, tag2');
    expect(result).toBe('#tag1 #tag2');
  });

  it('should handle already prefixed hashtags', () => {
    const result = TagsFormatter.format('#tag1 tag2');
    expect(result).toBe('#tag1 #tag2');
  });

  it('should convert to snake_case', () => {
    const result = TagsFormatter.format('camelCaseTag, PascalCaseTag, kebab-case-tag', {
      tagCase: 'snake_case'
    });
    expect(result).toBe('#camel_case_tag #pascal_case_tag #kebab_case_tag');
  });

  it('should convert to SNAKE_CASE', () => {
    const result = TagsFormatter.format('camelCaseTag', {
      tagCase: 'SNAKE_CASE'
    });
    expect(result).toBe('#CAMEL_CASE_TAG');
  });

  it('should convert to kebab-case', () => {
    const result = TagsFormatter.format('camelCaseTag, snake_case_tag', {
      tagCase: 'kebab-case'
    });
    expect(result).toBe('#camel-case-tag #snake-case-tag');
  });

  it('should convert to KEBAB-CASE', () => {
    const result = TagsFormatter.format('camelCaseTag', {
      tagCase: 'KEBAB-CASE'
    });
    expect(result).toBe('#CAMEL-CASE-TAG');
  });

  it('should convert to camelCase', () => {
    const result = TagsFormatter.format('snake_case_tag, kebab-case-tag', {
      tagCase: 'camelCase'
    });
    expect(result).toBe('#snakeCaseTag #kebabCaseTag');
  });

  it('should convert to pascalCase', () => {
    const result = TagsFormatter.format('snake_case_tag, kebab-case-tag', {
      tagCase: 'pascalCase'
    });
    expect(result).toBe('#SnakeCaseTag #KebabCaseTag');
  });

  it('should apply low case (words with spaces)', () => {
    const result = TagsFormatter.format('camelCaseTag, tag_two', {
      tagCase: 'lower_case'
    });
    expect(result).toBe('#camel case tag #tag two');
  });

  it('should apply UPPER CASE (words with spaces)', () => {
    const result = TagsFormatter.format('camelCaseTag, tag_two', {
      tagCase: 'upper_case'
    });
    expect(result).toBe('#CAMEL CASE TAG #TAG TWO');
  });

  it('should handle empty input', () => {
    expect(TagsFormatter.format('')).toBe('');
    expect(TagsFormatter.format(null)).toBe('');
    expect(TagsFormatter.format(undefined)).toBe('');
  });
});
