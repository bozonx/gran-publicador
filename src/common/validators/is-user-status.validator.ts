import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PublicationStatus } from '../../generated/prisma/index.js';

/**
 * Validator to ensure publication status can only be set to user-selectable values (DRAFT, READY, SCHEDULED)
 */
@ValidatorConstraint({ name: 'isUserStatus', async: false })
export class IsUserStatusConstraint implements ValidatorConstraintInterface {
  public validate(value: any, _args: ValidationArguments): boolean {
    if (!value) {
      return true; // Let @IsOptional handle undefined/null
    }

    // Only DRAFT, READY, and SCHEDULED are allowed for user input
    // SCHEDULED is typically set automatically when scheduledAt is provided
    const allowedStatuses = [
      PublicationStatus.DRAFT,
      PublicationStatus.READY,
      PublicationStatus.SCHEDULED,
    ];
    return allowedStatuses.includes(value);
  }

  public defaultMessage(_args: ValidationArguments): string {
    return 'Status can only be set to DRAFT, READY, or SCHEDULED. Other statuses are managed by the system.';
  }
}

/**
 * Decorator to validate that publication status is user-selectable (DRAFT, READY, or SCHEDULED)
 */
export function IsUserStatus(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsUserStatusConstraint,
    });
  };
}
