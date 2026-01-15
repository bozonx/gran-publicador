import { IsArray, IsString } from 'class-validator';

export class ReorderLlmPromptTemplatesDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
