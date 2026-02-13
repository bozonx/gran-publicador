/**
 * Frozen snapshot of everything needed for publishing a post.
 * Created when publication transitions from DRAFT to READY/SCHEDULED.
 * Used as the single source of truth by the scheduler/publisher.
 */
export interface PostingSnapshot {
  version: number;
  body: string;
  bodyFormat?: 'html' | 'markdown' | 'text';
  media: PostingSnapshotMedia[];

  meta?: {
    createdAt: string;
    publicationId: string;
    postId: string;
    channelId: string;
    platform?: string;

    inputs: {
      title?: string | null;
      content?: string | null;
      tags?: string | null;
      authorComment?: string | null;
      postType?: string | null;
      language?: string | null;
      authorSignature?: string | null;
    };

    template: {
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
    };
  };
}

export interface PostingSnapshotMedia {
  mediaId: string;
  type: string;
  storageType: string;
  storagePath: string;
  order: number;
  hasSpoiler: boolean;
  meta: Record<string, any>;
}

export const POSTING_SNAPSHOT_VERSION = 1;
