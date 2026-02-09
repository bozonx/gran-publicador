import { AbstractPlatformFormatter, type FormatterParams } from './abstract-platform.formatter.js';
import type { PostRequestDto } from '../../dto/social-posting.dto.js';
import { TagsFormatter } from '../tags.formatter.js';

export class DefaultFormatter extends AbstractPlatformFormatter {
  format(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId, snapshot } = params;

    // Body is already rendered in the snapshot
    const body = snapshot.body;
    const bodyFormat = snapshot.bodyFormat ?? 'markdown';

    const mediaMapping = this.mapSnapshotMedia(
      snapshot.media,
      params.mediaStorageUrl,
      params.publicMediaBaseUrl,
      params.mediaService,
    );

    const request: PostRequestDto = {
      platform: channel.socialMedia.toLowerCase(),
      channelId: targetChannelId,
      auth: {
        apiKey,
      },
      body,
      bodyFormat,
      idempotencyKey: `post-${post.id}-${new Date(post.updatedAt).getTime()}`,
      postLanguage: post.language || publication.language,
      ...mediaMapping,
    };

    // For other platforms we can provide title and description if available
    if (publication.title) request.title = publication.title;
    if (publication.description) request.description = publication.description;

    // Add tags as separate field if present
    const tagsString = post.tags || publication.tags;
    if (tagsString) {
      request.tags = TagsFormatter.toArray(tagsString);
    }

    this.applyCommonOptions(request, post);

    return request;
  }
}
