import { SocialPostingBodyFormatter } from '../../src/modules/social-posting/utils/social-posting-body.formatter.js';
import { PostType } from '../../src/generated/prisma/client.js';

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    language: 'ru-RU',
    preferences: {
      templates: []
    }
  };

  const simpleData = {
    title: 'Test Title',
    content: 'Test Content',
    description: 'Test Description',
    tags: 'tag1, tag2',
    postType: PostType.POST,
    language: 'ru-RU'
  };

  it('should use default template when no templates provided', () => {
    const result = SocialPostingBodyFormatter.format(simpleData, mockChannel);
    // Default: title disabled, content enabled, description (\n\n), tags (\n\n)
    expect(result).toContain('Test Content');
    expect(result).toContain('\n\nTest Description');
    expect(result).toContain('\n\n#tag1 #tag2');
    expect(result).not.toContain('Test Title');
  });

  it('should use specific template if matched by postType and language', () => {
    const channelWithTemplate = {
      ...mockChannel,
      preferences: {
        templates: [
          {
            id: '1',
            name: 'Special Template',
            postType: PostType.POST,
            language: 'ru-RU',
            template: [
              { enabled: true, insert: 'title', before: 'TITLE: ', after: '\n' },
              { enabled: true, insert: 'content', before: '', after: '' }
            ]
          }
        ]
      }
    };

    const result = SocialPostingBodyFormatter.format(simpleData, channelWithTemplate);
    expect(result).toBe('TITLE: Test Title\nTest Content');
  });

  it('should fallback to simpler template if exact match not found', () => {
    const channelWithTemplates = {
      ...mockChannel,
      preferences: {
        templates: [
          {
            id: '1',
            name: 'Generic Post',
            postType: PostType.POST,
            language: null,
            template: [{ enabled: true, insert: 'content', before: 'POST: ', after: '' }]
          },
          {
            id: '2',
            name: 'RU Template',
            postType: null,
            language: 'ru-RU',
            template: [{ enabled: true, insert: 'content', before: 'RU: ', after: '' }]
          }
        ]
      }
    };

    // Should prefer postType match over language match
    const result = SocialPostingBodyFormatter.format(simpleData, channelWithTemplates);
    expect(result).toBe('POST: Test Content');
  });

  it('should format tags correctly', () => {
    const dataWithTags = { ...simpleData, tags: '  tag1  tag2,tag3 #tag4 ' };
    const result = SocialPostingBodyFormatter.format(dataWithTags, mockChannel);
    expect(result).toContain('#tag1 #tag2 #tag3 #tag4');
  });

  it('should handle missing fields gracefully', () => {
    const minimalData = { content: 'Just content' };
    const result = SocialPostingBodyFormatter.format(minimalData, mockChannel);
    expect(result).toBe('Just content');
  });
});
