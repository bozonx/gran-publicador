import { BadRequestException, PipeTransform } from '@nestjs/common';
import { PublicationStatus } from '../../generated/prisma/client.js';

/**
 * Pipe to parse and validate PublicationStatus enum from query parameters.
 * Converts string to uppercase and validates against allowed values.
 */
export class ParsePublicationStatusPipe implements PipeTransform<string, PublicationStatus | undefined> {
  transform(value?: string): PublicationStatus | undefined {
    if (!value) {
      return undefined;
    }

    const upperValue = value.toUpperCase() as PublicationStatus;
    const validStatuses = Object.values(PublicationStatus);

    if (!validStatuses.includes(upperValue)) {
      throw new BadRequestException(
        `Invalid publication status. Allowed values: ${validStatuses.join(', ')}`,
      );
    }

    return upperValue;
  }
}
