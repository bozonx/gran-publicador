import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AvailableLlmPromptTemplatesQueryDto {
  @IsString()
  @IsOptional()
  @IsUUID()
  public projectId?: string;
}
