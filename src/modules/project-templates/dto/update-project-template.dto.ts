import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
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
 * DTO for updating an existing project template.
 */
export class UpdateProjectTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public name?: string;

  @IsEnum(PostType)
  @IsOptional()
  public postType?: PostType | null;

  @IsString()
  @IsOptional()
  @ValidateIf((o: any, v: any) => v !== null)
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public language?: string | null;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  public template?: TemplateBlockDto[];

  @IsInt()
  @IsOptional()
  public version?: number;
}
