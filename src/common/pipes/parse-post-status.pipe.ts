import { BadRequestException, PipeTransform } from '@nestjs/common';
import { PostStatus } from '../../generated/prisma/client.js';

/**
 * Pipe to parse and validate PostStatus enum from query parameters.
 * Converts string to uppercase and validates against allowed values.
 */
export class ParsePostStatusPipe implements PipeTransform<string, PostStatus | undefined> {
  transform(value?: string): PostStatus | undefined {
    if (!value) {
      return undefined;
    }

    const upperValue = value.toUpperCase() as PostStatus;
    const validStatuses = Object.values(PostStatus);

    if (!validStatuses.includes(upperValue)) {
      throw new BadRequestException(
        `Invalid post status. Allowed values: ${validStatuses.join(', ')}`,
      );
    }

    return upperValue;
  }
}
