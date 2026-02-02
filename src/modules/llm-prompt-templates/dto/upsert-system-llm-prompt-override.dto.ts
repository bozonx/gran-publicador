import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';
import { LlmPromptTemplateCategory } from '../../../generated/prisma/index.js';

export class UpsertSystemLlmPromptOverrideDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_NAME_LENGTH)
  public name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_PROMPT_LENGTH)
  public prompt?: string;

  @IsEnum(LlmPromptTemplateCategory)
  @IsOptional()
  public category?: LlmPromptTemplateCategory;

  @ValidateIf(o => o.name === undefined && o.description === undefined && o.prompt === undefined && o.category === undefined)
  @IsString({ message: 'At least one field must be provided' })
  private readonly _atLeastOneField?: string;
}
