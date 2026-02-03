import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class UpdateContentBlockDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public type?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_SOURCE_TEXT_CONTENT_LENGTH)
  public text?: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  @IsOptional()
  public order?: number;

  @IsObject()
  @IsOptional()
  public meta?: Record<string, any>;
}
