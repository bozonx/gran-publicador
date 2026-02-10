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
    const chunks = tags
      .split(',')
      .map(c => c.trim())
      .filter(c => c.length > 0);
    const individualTags: string[] = [];

    for (const chunk of chunks) {
      if (tagCase !== 'none') {
        individualTags.push(chunk.startsWith('#') ? chunk.slice(1) : chunk);
      } else {
        const subTags = chunk
          .split(/\s+/)
          .map(t => t.trim())
          .filter(t => t.length > 0)
          .map(t => (t.startsWith('#') ? t.slice(1) : t));
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
      .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
      .replace(/[-_]/g, ' ')
      .split(/\s+/)
      .map(w => w.toLowerCase())
      .filter(w => w.length > 0);

    if (words.length === 0) return str;

    switch (targetCase) {
      case 'camelCase':
        return (
          words[0] +
          words
            .slice(1)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join('')
        );
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

import type {
  TemplateBlock,
  ChannelTemplateVariation,
  ProjectTemplate,
  BlockOverride,
} from '~/types/channels';

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
      { enabled: false, insert: 'custom', before: '', after: '', content: '' },
      { enabled: true, insert: 'footer', before: '', after: '' },
    ];
  }

  /**
   * Build effective blocks by applying channel variation overrides on top of project template blocks.
   */
  static buildEffectiveBlocks(
    projectBlocks: TemplateBlock[],
    overrides?: Record<string, BlockOverride>,
  ): TemplateBlock[] {
    if (!overrides) return projectBlocks;

    return projectBlocks.map(block => {
      const override = overrides[block.insert];
      if (!override) return block;

      return {
        ...block,
        before: override.before !== undefined ? override.before : block.before,
        after: override.after !== undefined ? override.after : block.after,
        content: override.content !== undefined ? override.content : block.content,
        tagCase:
          override.tagCase !== undefined
            ? (override.tagCase as TemplateBlock['tagCase'])
            : block.tagCase,
      };
    });
  }

  static format(
    data: PublicationDataForFormatting,
    channel: { preferences?: any },
    templateOverride?: { id: string } | null,
    projectTemplates?: ProjectTemplate[],
  ): string {
    const preferences =
      typeof channel.preferences === 'string'
        ? JSON.parse(channel.preferences)
        : channel.preferences;
    const variations: ChannelTemplateVariation[] = preferences?.templates || [];

    let variation: ChannelTemplateVariation | null | undefined = null;

    if (templateOverride?.id) {
      const found = variations.find(t => t.id === templateOverride.id);
      if (found && !found.excluded) variation = found;
    }

    if (!variation) {
      variation = variations.find(t => t.isDefault && !t.excluded);
    }

    let blocks: TemplateBlock[];

    if (variation && projectTemplates) {
      const projectTemplate = projectTemplates.find(pt => pt.id === variation!.projectTemplateId);
      if (projectTemplate) {
        blocks = this.buildEffectiveBlocks(projectTemplate.template, variation.overrides);
      } else {
        blocks = this.getDefaultBlocks();
      }
    } else {
      blocks = this.getDefaultBlocks();
    }

    return this.renderBlocks(data, blocks);
  }

  private static renderBlocks(data: PublicationDataForFormatting, blocks: TemplateBlock[]): string {
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
        case 'footer':
          value = block.content || '';
          break;
      }

      const trimmedValue = value.trim();
      if (trimmedValue) {
        const blockParts = [block.before || '', trimmedValue, block.after || ''];

        formattedBlocks.push(blockParts.join(''));
      }
    }

    const result = formattedBlocks.join('\n\n');

    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
