import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class PublicationLlmChatContextDto {
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_LLM_CONTEXT_LENGTH)
  public content?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_CONTENT_ITEMS)
  @MaxLength(VALIDATION_LIMITS.MAX_ALT_TEXT_LENGTH, { each: true })
  public mediaDescriptions?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(VALIDATION_LIMITS.MAX_LLM_CONTEXT_LENGTH)
  public contextLimitChars?: number;
}

export class PublicationLlmChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_LLM_PROMPT_LENGTH)
  public message!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PublicationLlmChatContextDto)
  public context?: PublicationLlmChatContextDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  public temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(VALIDATION_LIMITS.MAX_LLM_MAX_TOKENS)
  public max_tokens?: number;

  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.MAX_NAME_LENGTH)
  public model?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(VALIDATION_LIMITS.MAX_TAGS_LENGTH)
  public tags?: string[];

  @IsOptional()
  @IsBoolean()
  public onlyRawResult?: boolean;
}
