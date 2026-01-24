import { AbstractPlatformFormatter, FormatterParams } from './abstract-platform.formatter.js';
import { PostRequestDto } from '../../dto/social-posting.dto.js';
import { SocialPostingBodyFormatter } from '../social-posting-body.formatter.js';
import { ContentConverter } from '../../../../common/utils/content-converter.util.js';

export class TelegramFormatter extends AbstractPlatformFormatter {
  format(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId, mediaStorageUrl } = params;

    // Generate body using templates
    let body = SocialPostingBodyFormatter.format(
      {
        title: publication.title,
        content: post.content || publication.content,
        tags: post.tags || publication.tags,
        authorComment: publication.authorComment,
        postType: publication.postType,
        language: post.language || publication.language,
        authorSignature: post.authorSignature,
      },
      channel,
      post.template, // Pass the template override
    );

    const mediaMapping = this.mapMedia(publication.media, mediaStorageUrl, params.publicMediaBaseUrl, params.mediaService);

    // Telegram specific: Convert MD to HTML
    body = ContentConverter.mdToTelegramHtml(body);

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
