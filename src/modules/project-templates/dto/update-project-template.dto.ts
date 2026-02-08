import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
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

  @IsBoolean()
  @IsOptional()
  public isDefault?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TemplateBlockDto)
  public template?: TemplateBlockDto[];
}
