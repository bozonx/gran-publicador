import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '../../../generated/prisma/index.js';
import { TemplateBlockDto } from '../../../common/dto/json-objects.dto.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for creating a new project template.
 */
export class CreateProjectTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name!: string;

  @IsEnum(PostType)
  @IsOptional()
  public postType?: PostType;

  @IsString()
  @IsOptional()
  @ValidateIf((o: any, v: any) => v !== null)
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public language?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  public template!: TemplateBlockDto[];
}
