import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator to ensure a date is in the future
 */
@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  public validate(value: any, _args: ValidationArguments): boolean {
    if (!value) {
      return true; // Let @IsOptional handle undefined/null
    }

    const date = new Date(value);
    const now = new Date();

    return date.getTime() > now.getTime();
  }

  public defaultMessage(_args: ValidationArguments): string {
    return 'Date must be in the future';
  }
}

/**
 * Decorator to validate that a date is in the future
 */
export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}
