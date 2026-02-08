import { AbstractPlatformFormatter, type FormatterParams } from './abstract-platform.formatter.js';
import type { PostRequestDto } from '../../dto/social-posting.dto.js';

export class TelegramFormatter extends AbstractPlatformFormatter {
  format(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId, snapshot } = params;

    // Body is already rendered and converted to HTML in the snapshot
    const body = snapshot.body;

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
      bodyFormat: 'html',
      idempotencyKey: `post-${post.id}-${new Date(post.updatedAt).getTime()}`,
      postLanguage: post.language || publication.language,
      ...mediaMapping,
    };

    this.applyCommonOptions(request, post);

    // Per instructions for Telegram:
    // - title: do not pass
    // - description: do not pass
    // - tags: do not pass (already in body)
    // - mode: do not pass

    return request;
  }
}
