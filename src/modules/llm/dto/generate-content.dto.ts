import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  /**
   * Main content to use as context.
   */
  @IsOptional()
  @IsString()
  content?: string;

  /**
   * Additional source texts to include in context.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceTextDto)
  sourceTexts?: SourceTextDto[];

  /**
   * Whether to include main content in the context.
   */
  @IsOptional()
  @IsBoolean()
  useContent?: boolean;

  /**
   * Indexes of source texts to include (if not provided, all are included).
   */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  selectedSourceIndexes?: number[];
}

/**
 * DTO for source text in context.
 */
export class SourceTextDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  source?: string;
}
