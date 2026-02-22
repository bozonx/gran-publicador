import { readFileSync, writeFileSync } from 'fs';

const filePath = '/mnt/disk2/workspace/gran-publicador/src/modules/social-posting/social-posting.service.ts';
let code = readFileSync(filePath, 'utf8');

const enqueuePostCode = `
  /**
   * Enqueues a single post for processing
   */
  async enqueuePost(postId: string, options: { force?: boolean } = {}): Promise<PublishResponseDto> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        channel: { include: { project: true } },
        publication: {
          include: {
            media: { include: { media: true }, orderBy: { order: 'asc' } },
          },
        },
      },
    });

    if (!post) throw new BadRequestException('Post not found');

    // Make sure the publication is marked as PROCESSING
    await this.prisma.publication.updateMany({
      where: {
        id: post.publicationId,
        status: { not: PublicationStatus.PROCESSING },
      },
      data: {
        status: PublicationStatus.PROCESSING,
        processingStartedAt: new Date(),
      },
    });

    try {
      await this.preparePostPayload(post.id, options.force);
      await this.publicationsQueue.add(
        PROCESS_POST_JOB,
        { postId: post.id, force: options.force },
        { 
           jobId: \`post-\${post.id}-\${Date.now()}\`,
           removeOnComplete: true,
           removeOnFail: false
        }
      );
      
      return {
        success: true,
        message: 'Post enqueued for processing',
        data: {
          postId,
          status: PostStatus.PENDING, // It's pending until worker picks it up
        },
      };
    } catch (error: any) {
      await this.checkAndUpdatePublicationStatus(post.publicationId);
      throw error;
    }
  }
`;

// Insert it right after enqueuePublication
const match = code.indexOf('async preparePostPayload');
if (match === -1) throw new Error('preparePostPayload not found');

code = code.substring(0, match) + enqueuePostCode + '\n  ' + code.substring(match);

writeFileSync(filePath, code);
console.log('Added enqueuePost');
