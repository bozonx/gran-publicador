export type TagCase = 
  | 'camelCase' 
  | 'pascalCase' 
  | 'snake_case' 
  | 'SNAKE_CASE' 
  | 'kebab-case' 
  | 'KEBAB-CASE' 
  | 'lower_case' 
  | 'upper_case' 
  | 'none';

export interface TagFormatOptions {
  tagCase?: TagCase;
}

export class TagsFormatter {
  static format(tags: string | null | undefined, options: TagFormatOptions = {}): string {
    if (!tags) return '';
    const tagCase = options.tagCase || 'none';
    const chunks = tags.split(',').map(c => c.trim()).filter(c => c.length > 0);
    const individualTags: string[] = [];

    for (const chunk of chunks) {
      if (tagCase !== 'none') {
        individualTags.push(chunk.startsWith('#') ? chunk.slice(1) : chunk);
      } else {
        const subTags = chunk.split(/\s+/)
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .map(t => t.startsWith('#') ? t.slice(1) : t);
        individualTags.push(...subTags);
      }
    }

    if (individualTags.length === 0) return '';

    const formattedTags = individualTags.map(tag => {
      let result = tag;
      if (tagCase !== 'none') {
        result = this.convertStringCase(result, tagCase);
      }
      return `#${result}`;
    });

    return formattedTags.join(' ');
  }

  private static convertStringCase(str: string, targetCase: TagCase): string {
    const words = str
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Basic camelCase split for frontend compatibility
      .replace(/[-_]/g, ' ')                 
      .split(/\s+/)
      .map(w => w.toLowerCase())
      .filter(w => w.length > 0);

    if (words.length === 0) return str;

    switch (targetCase) {
      case 'camelCase':
        return words[0] + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'pascalCase':
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
      case 'snake_case':
        return words.join('_');
      case 'SNAKE_CASE':
        return words.join('_').toUpperCase();
      case 'kebab-case':
        return words.join('-');
      case 'KEBAB-CASE':
        return words.join('-').toUpperCase();
      case 'lower_case':
        return words.join(' ');
      case 'upper_case':
        return words.join(' ').toUpperCase();
      default:
        return str;
    }
  }
}

import type { TemplateBlock, ChannelFooter, ChannelPostTemplate } from '~/types/channels';

export interface PublicationDataForFormatting {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  authorSignature?: string | null;
  postType?: string;
  language?: string;
}

export class SocialPostingBodyFormatter {
  private static getDefaultBlocks(): TemplateBlock[] {
    return [
      { enabled: false, insert: 'title', before: '', after: '' },
      { enabled: true, insert: 'content', before: '', after: '' },
      { enabled: true, insert: 'authorComment', before: '', after: '' },
      { enabled: true, insert: 'authorSignature', before: '', after: '' },
      { enabled: true, insert: 'tags', before: '', after: '', tagCase: 'snake_case' },
      { enabled: true, insert: 'custom', before: '', after: '', content: '' },
      { enabled: true, insert: 'footer', before: '', after: '' },
    ];
  }

  static format(
    data: PublicationDataForFormatting, 
    channel: { preferences?: any },
    templateOverride?: { id: string } | null
  ): string {
    const preferences = typeof channel.preferences === 'string' ? JSON.parse(channel.preferences) : channel.preferences;
    const templates: ChannelPostTemplate[] = preferences?.templates || [];
    
    let template: ChannelPostTemplate | null | undefined = null;

    if (templateOverride?.id) {
      template = templates.find(t => t.id === templateOverride.id);
    }

    if (!template) {
      template = templates.find(t => t.isDefault);
    }

    const blocks = template ? template.template : this.getDefaultBlocks();
    const formattedBlocks: string[] = [];

    for (const block of blocks) {
      if (!block.enabled) continue;

      let value = '';
      switch (block.insert) {
        case 'title':
          value = data.title || '';
          break;
        case 'content':
          value = data.content || '';
          break;
        case 'tags':
          value = TagsFormatter.format(data.tags, {
            tagCase: block.tagCase,
          });
          break;
        case 'authorComment':
          value = data.authorComment || '';
          break;
        case 'authorSignature':
          value = data.authorSignature || '';
          break;
        case 'custom':
          value = block.content || '';
          break;
        case 'footer': {
          const footers: ChannelFooter[] = preferences?.footers || [];
          let footerObj: ChannelFooter | undefined;
          
          if (block.footerId) {
            footerObj = footers.find((f) => f.id === block.footerId);
          } else {
            footerObj = footers.find((f) => f.isDefault);
          }
          
          value = footerObj?.content || '';
          break;
        }
      }

      const trimmedValue = value.trim();
      if (trimmedValue) {
        const blockParts = [
          block.before || '',
          trimmedValue,
          block.after || '',
        ];

        formattedBlocks.push(blockParts.join(''));
      }
    }

    let result = formattedBlocks.join('\n\n');
    
    // Replace placeholders
    const signature = data.authorSignature || '';
    result = result.replace(/\{\{authorSignature\}\}/g, signature);

    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
