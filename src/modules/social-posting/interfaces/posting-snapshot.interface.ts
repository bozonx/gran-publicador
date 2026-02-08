/**
 * Frozen snapshot of everything needed for publishing a post.
 * Created when publication transitions from DRAFT to READY/SCHEDULED.
 * Used as the single source of truth by the scheduler/publisher.
 */
export interface PostingSnapshot {
  version: number;
  body: string;
  media: PostingSnapshotMedia[];
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
