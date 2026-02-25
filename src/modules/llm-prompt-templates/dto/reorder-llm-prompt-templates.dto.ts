import { IsArray, IsString, ArrayMaxSize, IsOptional, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class ReorderLlmPromptTemplatesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_PROMPTS)
  ids!: string[];

  @IsOptional()
  @IsUUID()
  projectId?: string;
}
