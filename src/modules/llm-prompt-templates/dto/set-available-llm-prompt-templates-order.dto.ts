import { ArrayMaxSize, IsArray, IsString, IsUUID } from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class SetAvailableLlmPromptTemplatesOrderDto {
  @IsUUID()
  public projectId!: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_REORDER_PROMPTS)
  public ids!: string[];
}
