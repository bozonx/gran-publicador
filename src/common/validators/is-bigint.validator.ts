import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Validator constraint for BigInt values.
 */
@ValidatorConstraint({ name: 'isBigInt', async: false })
export class IsBigIntConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    return typeof value === 'bigint';
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a BigInt value`;
  }
}

/**
 * Decorator to validate that a value is a BigInt.
 */
export function IsBigInt(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsBigIntConstraint,
    });
  };
}

/**
 * Validator constraint for BigInt minimum value.
 */
@ValidatorConstraint({ name: 'minBigInt', async: false })
export class MinBigIntConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    const [minValue] = args.constraints;
    if (typeof value !== 'bigint') {
      return false;
    }
    return value >= BigInt(minValue);
  }

  defaultMessage(args: ValidationArguments): string {
    const [minValue] = args.constraints;
    return `${args.property} must not be less than ${minValue}`;
  }
}

/**
 * Decorator to validate minimum BigInt value.
 */
export function MinBigInt(minValue: number | bigint, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [minValue],
      validator: MinBigIntConstraint,
    });
  };
}
