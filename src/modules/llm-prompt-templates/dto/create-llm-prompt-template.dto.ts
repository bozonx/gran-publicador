import { IsString, IsNotEmpty, IsOptional, IsInt, Min, ValidateIf } from 'class-validator';

export class CreateLlmPromptTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsInt()
  @Min(0)
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
