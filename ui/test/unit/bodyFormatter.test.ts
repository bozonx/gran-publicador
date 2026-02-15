import { describe, it, expect } from 'vitest';
import { SocialPostingBodyFormatter } from '../../app/utils/bodyFormatter';

describe('SocialPostingBodyFormatter', () => {
  const mockProjectTemplates = [
    {
      id: 'pt1',
      name: 'Project Template 1',
      order: 0,
      template: [
        { enabled: true, insert: 'content', before: '', after: '' },
        { enabled: true, insert: 'footer', before: '', after: '', content: 'Footer 1 Content' },
      ],
    },
    {
      id: 'pt2',
      name: 'Project Template 2',
      order: 1,
      template: [
        { enabled: true, insert: 'content', before: '', after: '' },
        {
          enabled: true,
          insert: 'footer',
          before: '',
          after: '',
          content: 'Default Footer Content',
        },
      ],
    },
    {
      id: 'pt_mixed',
      name: 'Mixed Blocks',
      order: 2,
      template: [
        { enabled: false, insert: 'title', before: 'Title: ', after: '' },
        { enabled: true, insert: 'content', before: '', after: '' },
        { enabled: false, insert: 'authorComment', before: 'Comment: ', after: '' },
      ],
    },
  ];

  const mockChannel = {
    preferences: {
      templates: [
        {
          projectTemplateId: 'pt1',
        },
        {
          projectTemplateId: 'pt2',
        },
      ],
    },
  };

  const mockData = {
    content: 'Main Content',
    authorComment: 'Author Note',
    authorSignature: 'John Doe',
  };

  it('should use specific footer when selected in template', () => {
    // pt1 is default project template
    const result = SocialPostingBodyFormatter.format(
      mockData,
      mockChannel,
      mockProjectTemplates as any,
      null,
    );
    expect(result).toContain('Main Content');
    expect(result).toContain('Footer 1 Content');
    expect(result).not.toContain('Default Footer Content');
  });

  it('should use default footer when no footer selected in template', () => {
    // Preferred template pt2 should be selected when explicitly provided
    const result = SocialPostingBodyFormatter.format(
      mockData,
      mockChannel,
      mockProjectTemplates as any,
      'pt2',
    );
    expect(result).toContain('Main Content');
    expect(result).toContain('Default Footer Content');
  });

  it('should use default system template blocks if no template is default', () => {
    const result = SocialPostingBodyFormatter.format(
      mockData,
      { preferences: {} },
      mockProjectTemplates as any,
      'pt_missing',
    );
    // Default blocks include: content, authorComment, authorSignature, tags, footer (default with empty content)
    expect(result).toContain('Main Content');
    expect(result).toContain('Author Note');
    expect(result).toContain('John Doe');
  });

  it('should NOT replace {{authorSignature}} placeholder', () => {
    const customProjectTemplate = {
      id: 'pt_custom',
      template: [
        {
          enabled: true,
          insert: 'custom',
          before: '',
          after: '',
          content: 'Written by {{authorSignature}}',
        },
      ],
    };
    const channelWithCustom = {
      preferences: {
        templates: [
          {
            projectTemplateId: 'pt_custom',
          },
        ],
      },
    };

    const result = SocialPostingBodyFormatter.format(
      mockData,
      channelWithCustom,
      [customProjectTemplate] as any,
      null,
    );
    expect(result).toBe('Written by {{authorSignature}}');
  });

  it('should respect enabled/disabled template blocks', () => {
    const channelWithMixedBlocks = {
      preferences: {
        templates: [
          {
            projectTemplateId: 'pt_mixed',
          },
        ],
      },
    };

    const data = {
      title: 'Post Title',
      content: 'Hello World',
      authorComment: 'Hidden Comment',
    };

    const result = SocialPostingBodyFormatter.format(
      data,
      channelWithMixedBlocks,
      mockProjectTemplates as any,
      'pt_mixed',
    );
    expect(result).toBe('Hello World');
    expect(result).not.toContain('Post Title');
    expect(result).not.toContain('Hidden Comment');
  });

  it('should allow disabling template blocks on channel variation level', () => {
    const channelWithOverrideDisabled = {
      preferences: {
        templates: [
          {
            projectTemplateId: 'pt1',
            overrides: {
              footer: {
                enabled: false,
              },
            },
          },
        ],
      },
    };

    const result = SocialPostingBodyFormatter.format(
      mockData,
      channelWithOverrideDisabled,
      mockProjectTemplates as any,
      null,
    );

    expect(result).toContain('Main Content');
    expect(result).not.toContain('Footer 1 Content');
  });

  it('should format tags correctly with default snake_case', () => {
    const data = {
      content: 'Post',
      tags: 'First Tag, SecondTag',
    };
    // Default system template includes tags with snake_case
    const result = SocialPostingBodyFormatter.format(data, { preferences: {} });
    expect(result).toContain('#first_tag');
    expect(result).toContain('#second_tag');
  });
});
