import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { SocialMedia } from '../../generated/prisma/enums.js';
import {
  validatePostContent,
  PostValidationData,
} from './social-media-validation.validator.js';

/**
 * Custom validator for social media post content
 */
@ValidatorConstraint({ name: 'isSocialMediaContentValid', async: false })
export class IsSocialMediaContentValidConstraint
  implements ValidatorConstraintInterface
{
  validate(value: any, args: ValidationArguments): boolean {
    const object = args.object as any;

    // Get required fields from the object
    const socialMedia: SocialMedia = object.socialMedia;
    const content: string | null | undefined = object.content;
    const mediaCount: number = object.mediaCount || 0;

    if (!socialMedia) {
      return false;
    }

    const validationData: PostValidationData = {
      content,
      mediaCount,
      socialMedia,
    };

    const result = validatePostContent(validationData);
    return result.isValid;
  }

  defaultMessage(args: ValidationArguments): string {
    const object = args.object as any;
    const socialMedia: SocialMedia = object.socialMedia;
    const content: string | null | undefined = object.content;
    const mediaCount: number = object.mediaCount || 0;

    if (!socialMedia) {
      return 'Social media platform is required';
    }

    const validationData: PostValidationData = {
      content,
      mediaCount,
      socialMedia,
    };

    const result = validatePostContent(validationData);
    return result.errors.join('; ');
  }
}

/**
 * Decorator for validating social media post content
 * Usage: @IsSocialMediaContentValid()
 */
export function IsSocialMediaContentValid(
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSocialMediaContentValidConstraint,
    });
  };
}
