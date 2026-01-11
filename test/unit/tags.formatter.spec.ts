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
      stringCase: 'snake_case'
    });
    expect(result).toBe('#camel_case_tag #pascal_case_tag #kebab_case_tag');
  });

  it('should convert to kebab-case', () => {
    const result = TagsFormatter.format('camelCaseTag, snake_case_tag', {
      stringCase: 'kebab-case'
    });
    expect(result).toBe('#camel-case-tag #snake-case-tag');
  });

  it('should convert to camelCase', () => {
    const result = TagsFormatter.format('snake_case_tag, kebab-case-tag', {
      stringCase: 'camelCase'
    });
    expect(result).toBe('#snakeCaseTag #kebabCaseTag');
  });

  it('should convert to pascalCase', () => {
    const result = TagsFormatter.format('snake_case_tag, kebab-case-tag', {
      stringCase: 'pascalCase'
    });
    expect(result).toBe('#SnakeCaseTag #KebabCaseTag');
  });

  it('should apply uppercase', () => {
    const result = TagsFormatter.format('tag1, tag2', {
      letterCase: 'uppercase'
    });
    expect(result).toBe('#TAG1 #TAG2');
  });

  it('should apply lowercase', () => {
    const result = TagsFormatter.format('TAG1, TAG2', {
      letterCase: 'lowercase'
    });
    expect(result).toBe('#tag1 #tag2');
  });

  it('should combine stringCase and letterCase', () => {
    const result = TagsFormatter.format('camelCaseTag', {
      stringCase: 'snake_case',
      letterCase: 'uppercase'
    });
    expect(result).toBe('#CAMEL_CASE_TAG');
  });

  it('should handle empty input', () => {
    expect(TagsFormatter.format('')).toBe('');
    expect(TagsFormatter.format(null)).toBe('');
    expect(TagsFormatter.format(undefined)).toBe('');
  });
});
