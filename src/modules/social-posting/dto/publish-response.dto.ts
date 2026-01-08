import { PublicationStatus, PostStatus } from '../../../generated/prisma/client.js';

export class PublishResponseDto {
  success!: boolean;
  message!: string;
  data?: {
    publicationId?: string;
    postId?: string;
    status: PublicationStatus | PostStatus;
    publishedCount?: number;
    failedCount?: number;
    results?: Array<{
      postId: string;
      channelId: string;
      success: boolean;
      error?: string;
    }>;
  };
}
