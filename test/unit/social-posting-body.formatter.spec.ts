import { SocialPostingBodyFormatter } from '../../src/modules/social-posting/utils/social-posting-body.formatter.js';
import { describe, it, expect } from '@jest/globals';

describe('SocialPostingBodyFormatter', () => {
  const mockChannel = {
    language: 'en-US',
    preferences: {
      templates: [
        {
          id: 'var-default',
          name: 'Default variation',
          order: 0,
          isDefault: true,
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
      language: 'en-US',
      preferences: {},
    });
    expect(result).toContain('Main Content');
  });

  it('should include author signature block correctly with overrides', () => {
    const dataWithSignature = {
      ...mockData,
      authorSignature: 'John Doe',
    };

    const result = SocialPostingBodyFormatter.format(
      dataWithSignature,
      mockChannel,
      null,
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
            id: 'var-custom',
            name: 'Custom variation',
            order: 0,
            isDefault: true,
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
      null,
      projectTemplates as any,
    );
    expect(result).toBe('Written by {{authorSignature}}');
  });
});
