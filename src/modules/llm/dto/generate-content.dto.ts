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
  MaxLength,
  ArrayMaxSize,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for generating content with LLM.
 */
export class GenerateContentDto {
  /**
   * The prompt to send to the LLM.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_LLM_PROMPT_LENGTH)
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
  @IsInt()
  @Min(1)
  @Max(VALIDATION_LIMITS.MAX_LLM_MAX_TOKENS)
  max_tokens?: number;

  /**
   * Specific model to use.
   */
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  model?: string;

  /**
   * Tags for model filtering.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  tags?: string[];

  /**
   * Main content to use as context.
   */
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_LLM_CONTEXT_LENGTH)
  content?: string;

  /**
   * Additional source texts to include in context.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceTextDto)
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_SOURCE_TEXTS)
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
  @IsInt({ each: true })
  @Min(0, { each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_SELECTED_INDEXES)
  selectedSourceIndexes?: number[];
}

/**
 * DTO for source text in context.
 */
export class SourceTextDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_SOURCE_TEXT_CONTENT_LENGTH)
  content!: string;

  @IsOptional()
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_ORDER)
  @Max(VALIDATION_LIMITS.MAX_ORDER)
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  source?: string;
}
