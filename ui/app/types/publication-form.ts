import type { PostType, PublicationStatus } from './posts';

/**
 * Publication form data structure
 */
export interface PublicationFormData {
  title: string | null;
  description: string | null;
  content: string | null;
  authorComment: string | null;
  note: string | null;
  tags: string | null;
  language: string;
  postType: PostType;
  status: PublicationStatus;
  meta: Record<string, any>;
  postDate: string | null;
  scheduledAt?: string;
  channelIds: string[];
}

/**
 * Validation error structure
 */
export interface ValidationError {
  channel: string;
  message: string;
}
