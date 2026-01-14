import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';

/**
 * DTO for generating content with LLM.
 */
export class GenerateContentDto {
  /**
   * The prompt to send to the LLM.
   */
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  /**
   * Temperature parameter (0-2).
   * Controls randomness of the response.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /**
   * Maximum number of tokens in the response.
   */
  @IsOptional()
  @IsNumber()
  @Min(1)
  max_tokens?: number;

  /**
   * Specific model to use.
   */
  @IsOptional()
  @IsString()
  model?: string;

  /**
   * Tags for model filtering.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
