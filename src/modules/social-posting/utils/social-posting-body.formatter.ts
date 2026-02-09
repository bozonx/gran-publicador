import type { PostType } from '../../../generated/prisma/index.js';
import { TagsFormatter, type TagCase } from './tags.formatter.js';

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'tags' | 'authorComment' | 'authorSignature' | 'footer' | 'custom';
  before: string;
  after: string;
  tagCase?: TagCase;
  content?: string;
}

/**
 * Overrides for a single block type in a channel variation.
 */
export interface BlockOverride {
  before?: string;
  after?: string;
  content?: string;
  tagCase?: TagCase;
}

/**
 * Channel template variation linked to a project template.
 */
export interface ChannelTemplateVariation {
  id: string;
  name: string;
  order: number;
  isDefault?: boolean;
  projectTemplateId: string;
  overrides?: Record<string, BlockOverride>;
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  postType?: PostType;
  language?: string;
  authorSignature?: string | null;
}

/**
 * Project template structure (matches DB model).
 */
export interface ProjectTemplateData {
  id: string;
  name: string;
  postType: PostType | null;
  isDefault?: boolean;
  order: number;
  template: TemplateBlock[];
}

export class SocialPostingBodyFormatter {
  /**
   * Default template blocks used when no template is selected.
   */
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
        tagCase: override.tagCase !== undefined ? override.tagCase : block.tagCase,
      };
    });
  }

  /**
   * Formats the body text based on project templates + channel variations.
   *
   * Resolution order:
   * 1. Explicit templateOverride.id → find matching channel variation
   * 2. Channel default variation (isDefault)
   * 3. Hardcoded default blocks
   *
   * For each variation found, the effective blocks are built by merging
   * the project template's blocks with the variation's overrides.
   */
  static format(
    data: PublicationData,
    channel: { language: string; preferences?: any },
    templateOverride?: { id: string } | null,
    projectTemplates?: ProjectTemplateData[],
  ): string {
    const variations: ChannelTemplateVariation[] = channel.preferences?.templates || [];

    let variation: ChannelTemplateVariation | null | undefined = null;

    // 1. Explicit selection (Highest Priority)
    if (templateOverride?.id) {
      variation = variations.find(t => t.id === templateOverride.id);
    }

    // 2. Channel Default
    if (!variation) {
      variation = variations.find(t => t.isDefault);
    }

    let blocks: TemplateBlock[];

    if (variation && projectTemplates) {
      // Find the linked project template
      const projectTemplate = projectTemplates.find(pt => pt.id === variation.projectTemplateId);
      if (projectTemplate) {
        blocks = this.buildEffectiveBlocks(projectTemplate.template, variation.overrides);
      } else {
        // Project template was deleted or not found — fallback to defaults
        blocks = this.getDefaultBlocks();
      }
    } else {
      blocks = this.getDefaultBlocks();
    }

    return this.renderBlocks(data, blocks);
  }

  /**
   * Render template blocks into formatted text.
   */
  private static renderBlocks(data: PublicationData, blocks: TemplateBlock[]): string {
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

    // Join all blocks with double newline (one empty line between them)
    const result = formattedBlocks.join('\n\n');

    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
