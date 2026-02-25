import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class CreateLlmPromptTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_NAME_LENGTH)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_DESCRIPTION_LENGTH)
  public note?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_PROMPT_LENGTH)
  prompt!: string;

  @IsString()
  @IsOptional()
  @MaxLength(VALIDATION_LIMITS.MAX_PROMPT_TEMPLATE_NAME_LENGTH)
  category?: string;

  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  @IsOptional()
  order?: number;

  // Either userId or projectId must be provided, but not both
  @IsString()
  @IsOptional()
  @ValidateIf(o => !o.projectId)
  @IsNotEmpty({ message: 'Either userId or projectId must be provided' })
  userId?: string;

  @IsString()
  @IsOptional()
  @ValidateIf(o => !o.userId)
  @IsNotEmpty({ message: 'Either userId or projectId must be provided' })
  projectId?: string;
}
