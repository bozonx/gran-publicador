import { BadRequestException, PipeTransform } from '@nestjs/common';
import { PostType } from '../../generated/prisma/client.js';

/**
 * Pipe to parse and validate PostType enum from query parameters.
 * Converts string to uppercase and validates against allowed values.
 */
export class ParsePostTypePipe implements PipeTransform<string, PostType | undefined> {
  transform(value?: string): PostType | undefined {
    if (!value) {
      return undefined;
    }

    const upperValue = value.toUpperCase() as PostType;
    const validTypes = Object.values(PostType);

    if (!validTypes.includes(upperValue)) {
      throw new BadRequestException(
        `Invalid post type. Allowed values: ${validTypes.join(', ')}`,
      );
    }

    return upperValue;
  }
}
