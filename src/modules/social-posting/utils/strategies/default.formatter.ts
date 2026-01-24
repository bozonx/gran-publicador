import { AbstractPlatformFormatter, FormatterParams } from './abstract-platform.formatter.js';
import { PostRequestDto } from '../../dto/social-posting.dto.js';
import { SocialPostingBodyFormatter } from '../social-posting-body.formatter.js';
import { TagsFormatter } from '../tags.formatter.js';

export class DefaultFormatter extends AbstractPlatformFormatter {
  format(params: FormatterParams): PostRequestDto {
    const { post, channel, publication, apiKey, targetChannelId, mediaStorageUrl } = params;

    // Generate body using templates
    const body = SocialPostingBodyFormatter.format(
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

    const request: PostRequestDto = {
      platform: channel.socialMedia.toLowerCase(),
      channelId: targetChannelId,
      auth: {
        apiKey,
      },
      body,
      bodyFormat: 'html', // Default for now
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
      (request as any).tags = TagsFormatter.format(tagsString);
    }

    this.applyCommonOptions(request, post);

    return request;
  }
}
