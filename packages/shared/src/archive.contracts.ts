export const ArchiveEntityType = {
  PROJECT: 'project',
  CHANNEL: 'channel',
  PUBLICATION: 'publication',
} as const;

export type ArchiveEntityType = (typeof ArchiveEntityType)[keyof typeof ArchiveEntityType];

export interface MoveEntityRequest {
  targetParentId: string;
}

export interface ArchiveStats {
  projects: number;
  channels: number;
  publications: number;
  posts: number;
  total: number;
}
