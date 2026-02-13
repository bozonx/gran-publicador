import { SocialPostingBodyFormatter } from '../../src/modules/social-posting/utils/social-posting-body.formatter.js';
import { describe, it, expect } from '@jest/globals';

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    language: 'en-US',
    preferences: {
      templates: [
        {
          projectTemplateId: 'pt-1',
          overrides: {
            authorSignature: { before: 'By: ', after: '' },
          },
        },
      ],
    },
  };

  const mockProjectTemplates = [
    {
      id: 'pt-1',
      name: 'Project template',
      postType: null,
      isDefault: true,
      order: 0,
      template: [
        { enabled: true, insert: 'content', before: '', after: '' },
        { enabled: true, insert: 'authorSignature', before: '', after: '' },
      ],
    },
  ];

  const mockData = {
    content: 'Main Content',
    authorComment: 'Author Note',
  };

  it('should render default blocks when no variation or project templates are provided', () => {
    const result = SocialPostingBodyFormatter.format(mockData, {
      preferences: {},
    });
    expect(result).toContain('Main Content');
  });

  it('should prefer publication project template when provided, applying channel variation overrides for that template', () => {
    const channel = {
      preferences: {
        templates: [
          {
            projectTemplateId: 'pt-2',
            overrides: {
              authorSignature: { before: 'Sig: ', after: '' },
            },
          },
          {
            projectTemplateId: 'pt-1',
          },
        ],
      },
    };

    const projectTemplates = [
      {
        id: 'pt-1',
        name: 'PT-1',
        postType: null,
        isDefault: true,
        order: 0,
        template: [
          { enabled: true, insert: 'content', before: '', after: '' },
          { enabled: true, insert: 'authorSignature', before: '', after: '' },
        ],
      },
      {
        id: 'pt-2',
        name: 'PT-2',
        postType: null,
        isDefault: false,
        order: 1,
        template: [
          { enabled: true, insert: 'content', before: '', after: '' },
          { enabled: true, insert: 'authorSignature', before: '', after: '' },
        ],
      },
    ];

    const result = SocialPostingBodyFormatter.format(
      { ...mockData, authorSignature: 'John Doe' },
      channel,
      projectTemplates as any,
      'pt-2',
    );

    expect(result).toBe('Main Content\n\nSig: John Doe');
  });

  it('should ignore excluded override variation and fallback to preferred template variation', () => {
    const channel = {
      preferences: {
        templates: [
          {
            excluded: true,
            projectTemplateId: 'pt-2',
          },
        ],
      },
    };

    const projectTemplates = [
      {
        id: 'pt-2',
        name: 'PT-2',
        postType: null,
        isDefault: true,
        order: 0,
        template: [
          { enabled: true, insert: 'content', before: '', after: '' },
          { enabled: true, insert: 'authorSignature', before: '', after: '' },
        ],
      },
    ];

    const result = SocialPostingBodyFormatter.format(
      { ...mockData, authorSignature: 'John Doe' },
      channel,
      projectTemplates as any,
      'pt-2',
    );

    expect(result).toBe('Main Content\n\nJohn Doe');
  });

  it('should include author signature block correctly with overrides', () => {
    const dataWithSignature = {
      ...mockData,
      authorSignature: 'John Doe',
    };

    const result = SocialPostingBodyFormatter.format(
      dataWithSignature,
      mockChannel,
      mockProjectTemplates as any,
    );

    expect(result).toBe('Main Content\n\nBy: John Doe');
  });

  it('should NOT replace {{authorSignature}} placeholder in custom block', () => {
    const channelWithCustom = {
      language: 'en-US',
      preferences: {
        templates: [
          {
            projectTemplateId: 'pt-custom',
          },
        ],
      },
    };

    const projectTemplates = [
      {
        id: 'pt-custom',
        name: 'Custom',
        postType: null,
        isDefault: true,
        order: 0,
        template: [
          {
            enabled: true,
            insert: 'custom',
            before: '',
            after: '',
            content: 'Written by {{authorSignature}}',
          },
        ],
      },
    ];

    const result = SocialPostingBodyFormatter.format(
      mockData,
      channelWithCustom,
      projectTemplates as any,
    );
    expect(result).toBe('Written by {{authorSignature}}');
  });
});
