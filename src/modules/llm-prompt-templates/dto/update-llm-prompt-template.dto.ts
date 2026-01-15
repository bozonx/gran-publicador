import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateLlmPromptTemplateDto } from './create-llm-prompt-template.dto.js';

// Omit userId and projectId from updates (they can't be changed after creation)
export class UpdateLlmPromptTemplateDto extends PartialType(
  OmitType(CreateLlmPromptTemplateDto, ['userId', 'projectId'] as const),
) {}
