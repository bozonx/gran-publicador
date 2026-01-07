import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PublicationStatus } from '../../generated/prisma/client.js';

/**
 * Validator to ensure publication status can only be set to user-selectable values (DRAFT or READY)
 */
@ValidatorConstraint({ name: 'isUserStatus', async: false })
export class IsUserStatusConstraint implements ValidatorConstraintInterface {
  public validate(value: any, _args: ValidationArguments): boolean {
    if (!value) {
      return true; // Let @IsOptional handle undefined/null
    }

    // Only DRAFT and READY are allowed for user input
    const allowedStatuses = [PublicationStatus.DRAFT, PublicationStatus.READY];
    return allowedStatuses.includes(value);
  }

  public defaultMessage(_args: ValidationArguments): string {
    return 'Status can only be set to DRAFT or READY. Other statuses are managed by the system.';
  }
}

/**
 * Decorator to validate that publication status is user-selectable (DRAFT or READY)
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
