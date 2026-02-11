export const PostStatus = {
  PENDING: 'PENDING',
  FAILED: 'FAILED',
  PUBLISHED: 'PUBLISHED',
} as const;

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const PublicationStatus = {
  DRAFT: 'DRAFT',
  READY: 'READY',
  SCHEDULED: 'SCHEDULED',
  PROCESSING: 'PROCESSING',
  PUBLISHED: 'PUBLISHED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED',
} as const;

export type PublicationStatus = (typeof PublicationStatus)[keyof typeof PublicationStatus];
