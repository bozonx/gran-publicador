export type TagCase = 
  | 'camelCase' 
  | 'pascalCase' 
  | 'snake_case' 
  | 'SNAKE_CASE' 
  | 'kebab-case' 
  | 'KEBAB-CASE' 
  | 'lowercase' 
  | 'uppercase' 
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
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Simple regex for camelCase splitting (frontend doesn't always support \p{L})
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
      case 'lowercase':
        return words.join(' ');
      case 'uppercase':
        return words.join(' ').toUpperCase();
      default:
        return str;
    }
  }
}

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'description' | 'tags';
  before: string;
  after: string;
  tagCase?: TagCase;
}

export interface ChannelFooter {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

export interface ChannelPostTemplate {
  id: string;
  name: string;
  order: number;
  postType: string | null;
  language: string | null;
  footerId?: string | null;
  template: TemplateBlock[];
  isDefault?: boolean;
}

export interface PublicationDataForFormatting {
  title?: string | null;
  content?: string | null;
  description?: string | null;
  tags?: string | null;
  postType?: string;
  language?: string;
}

export class SocialPostingBodyFormatter {
  private static getDefaultBlocks(): TemplateBlock[] {
    return [
      { enabled: false, insert: 'title', before: '', after: '\n\n' },
      { enabled: true, insert: 'content', before: '', after: '' },
      { enabled: true, insert: 'description', before: '\n\n', after: '' },
      { enabled: true, insert: 'tags', before: '\n\n', after: '' },
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
    
    let result = '';

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
        case 'description':
          value = data.description || '';
          break;
        case 'tags':
          value = TagsFormatter.format(data.tags, {
            tagCase: block.tagCase,
          });
          break;
      }

      if (value && value.trim()) {
        result += block.before + value.trim() + block.after;
      }
    }

    const footers: ChannelFooter[] = preferences?.footers || [];
    let footerObj: ChannelFooter | undefined;

    if (template && template.footerId) {
       footerObj = footers.find(f => f.id === template.footerId);
    } else {
       footerObj = footers.find(f => f.isDefault);
    }

    if (footerObj && footerObj.content && footerObj.content.trim()) {
      result += '\n\n' + footerObj.content.trim();
    }

    return result.trim();
  }
}
