import { TagsFormatter, type TagCase } from './tags-formatter.js';

export interface TemplateBlock {
  enabled: boolean;
  insert: 'title' | 'content' | 'tags' | 'authorComment' | 'authorSignature' | 'footer' | 'custom';
  before: string;
  after: string;
  tagCase?: TagCase;
  content?: string;
}

export interface BlockOverride {
  enabled?: boolean;
  before?: string;
  after?: string;
  content?: string;
  tagCase?: TagCase;
}

export interface ChannelTemplateVariation {
  id: string;
  name: string;
  order: number;
  isDefault?: boolean;
  projectTemplateId: string;
  excluded?: boolean;
  overrides?: Record<string, BlockOverride>;
}

export interface PublicationData {
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  authorComment?: string | null;
  authorSignature?: string | null;
  postType?: string;
  language?: string;
}

export interface ProjectTemplateData {
  id: string;
  name: string;
  postType: string | null;
  isDefault?: boolean;
  order: number;
  template: TemplateBlock[];
}

export interface TemplateResolutionMeta {
  preferredProjectTemplateId?: string | null;
  resolvedVariationId?: string | null;
  resolvedProjectTemplateId?: string | null;
  resolution:
    | 'preferred_template_channel_default'
    | 'preferred_template_first_variation'
    | 'channel_default'
    | 'fallback_default_blocks'
    | 'missing_project_template_fallback';
  hasOverrides?: boolean;
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
      { enabled: true, insert: 'footer', before: '', after: '', content: '' },
    ];
  }

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
        enabled: override.enabled !== undefined ? override.enabled : block.enabled,
        before: override.before !== undefined ? override.before : block.before,
        after: override.after !== undefined ? override.after : block.after,
        content: override.content !== undefined ? override.content : block.content,
        tagCase: override.tagCase !== undefined ? override.tagCase : block.tagCase,
      };
    });
  }

  static formatWithMeta(options: {
    data: PublicationData;
    channel: { preferences?: any };
    projectTemplates?: ProjectTemplateData[];
    preferredProjectTemplateId?: string | null;
  }): { body: string; template: TemplateResolutionMeta };
  static formatWithMeta(
    data: PublicationData,
    channel: { preferences?: any },
    projectTemplates?: ProjectTemplateData[],
    preferredProjectTemplateId?: string | null,
  ): { body: string; template: TemplateResolutionMeta };
  static formatWithMeta(
    dataOrOptions:
      | {
          data: PublicationData;
          channel: { preferences?: any };
          projectTemplates?: ProjectTemplateData[];
          preferredProjectTemplateId?: string | null;
        }
      | PublicationData,
    channelArg?: { preferences?: any },
    projectTemplatesArg?: ProjectTemplateData[],
    preferredProjectTemplateIdArg?: string | null,
  ): { body: string; template: TemplateResolutionMeta } {
    const options =
      typeof dataOrOptions === 'object' && dataOrOptions !== null && 'data' in dataOrOptions
        ? dataOrOptions
        : {
            data: dataOrOptions as PublicationData,
            channel: channelArg ?? {},
            projectTemplates: projectTemplatesArg,
            preferredProjectTemplateId: preferredProjectTemplateIdArg,
          };

    const { data, channel, projectTemplates, preferredProjectTemplateId } = options;

    const preferences =
      typeof channel.preferences === 'string'
        ? JSON.parse(channel.preferences)
        : channel.preferences;

    const variations: ChannelTemplateVariation[] = preferences?.templates || [];

    let variation: ChannelTemplateVariation | null | undefined = null;
    let resolution: TemplateResolutionMeta['resolution'] = 'fallback_default_blocks';

    const preferredTplId = preferredProjectTemplateId ?? null;

    const findProjectTemplate = (id: string | null | undefined) =>
      id && projectTemplates ? projectTemplates.find(pt => pt.id === id) : undefined;

    const allowedVariations = preferredTplId
      ? variations.filter(v => v.projectTemplateId === preferredTplId)
      : variations;

    // 1) Preferred template: choose channel default variation within preferred template
    if (!variation && preferredTplId) {
      variation = allowedVariations.find(v => v.isDefault && !v.excluded);
      if (variation) {
        resolution = 'preferred_template_channel_default';
      }
    }

    // 2) Preferred template: fallback to first non-excluded variation for that template
    if (!variation && preferredTplId) {
      variation = allowedVariations
        .filter(v => !v.excluded)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];

      if (variation) {
        resolution = 'preferred_template_first_variation';
      }
    }

    // 3) Generic channel default (no preferred template)
    if (!variation && !preferredTplId) {
      variation = variations.find(v => v.isDefault && !v.excluded);
      if (variation) {
        resolution = 'channel_default';
      }
    }

    let blocks: TemplateBlock[];
    let resolvedProjectTemplateId: string | null | undefined = null;

    if (variation && projectTemplates) {
      const projectTemplate = findProjectTemplate(variation.projectTemplateId);
      if (projectTemplate) {
        resolvedProjectTemplateId = projectTemplate.id;
        blocks = this.buildEffectiveBlocks(projectTemplate.template, variation.overrides);
      } else {
        resolution = 'missing_project_template_fallback';
        blocks = this.getDefaultBlocks();
      }
    } else if (preferredTplId && projectTemplates) {
      const projectTemplate = findProjectTemplate(preferredTplId);
      if (projectTemplate) {
        resolvedProjectTemplateId = projectTemplate.id;
        blocks = projectTemplate.template;
      } else {
        resolution = 'missing_project_template_fallback';
        blocks = this.getDefaultBlocks();
      }
    } else {
      blocks = this.getDefaultBlocks();
    }

    return {
      body: this.renderBlocks(data, blocks),
      template: {
        preferredProjectTemplateId: preferredTplId,
        resolvedVariationId: variation?.id ?? null,
        resolvedProjectTemplateId,
        resolution,
        hasOverrides: variation?.overrides ? Object.keys(variation.overrides).length > 0 : false,
      },
    };
  }

  static format(options: {
    data: PublicationData;
    channel: { preferences?: any };
    projectTemplates?: ProjectTemplateData[];
    preferredProjectTemplateId?: string | null;
  }): string;
  static format(
    data: PublicationData,
    channel: { preferences?: any },
    projectTemplates?: ProjectTemplateData[],
    preferredProjectTemplateId?: string | null,
  ): string;
  static format(
    dataOrOptions:
      | {
          data: PublicationData;
          channel: { preferences?: any };
          projectTemplates?: ProjectTemplateData[];
          preferredProjectTemplateId?: string | null;
        }
      | PublicationData,
    channelArg?: { preferences?: any },
    projectTemplatesArg?: ProjectTemplateData[],
    preferredProjectTemplateIdArg?: string | null,
  ): string {
    if (typeof dataOrOptions === 'object' && dataOrOptions !== null && 'data' in dataOrOptions) {
      return this.formatWithMeta(dataOrOptions).body;
    }

    return this.formatWithMeta(
      dataOrOptions as PublicationData,
      channelArg ?? {},
      projectTemplatesArg,
      preferredProjectTemplateIdArg,
    ).body;
  }

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

    const result = formattedBlocks.join('\n\n');
    return result.trim().replace(/\n{3,}/g, '\n\n');
  }
}
