import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsIn,
  MaxLength,
} from 'class-validator';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

/**
 * DTO for translating text via Translate Gateway microservice.
 */
export class TranslateTextDto {
  /**
   * Source text to translate.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(VALIDATION_LIMITS.MAX_TRANSLATE_TEXT_LENGTH)
  text!: string;

  /**
   * Target language in BCP-47 format (e.g., ru-RU, en-US).
   */
  @IsString()
  @IsNotEmpty()
  targetLang!: string;

  /**
   * Source language in BCP-47 format.
   * If omitted, null, empty string, or "auto", the source language is auto-detected.
   */
  @IsOptional()
  @IsString()
  sourceLang?: string;

  /**
   * Translation provider (anylang, google, deepl, etc.).
   * If omitted, uses default from config.
   */
  @IsOptional()
  @IsString()
  provider?: string;

  /**
   * Model name for providers that support multiple engines.
   * If omitted, uses provider-specific default.
   */
  @IsOptional()
  @IsString()
  model?: string;

  /**
   * Per-request override for maximum allowed input text length (characters).
   * Range: 100-10000000. If omitted or 0, uses config default.
   */
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(VALIDATION_LIMITS.MAX_TRANSLATE_TEXT_LENGTH)
  maxTextLength?: number;

  /**
   * Per-request override for text chunk limit (characters).
   * Range: 0-1000000. If omitted or 0, uses provider default.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000000)
  maxChunkLength?: number;

  /**
   * Text splitting strategy.
   * Default is "paragraph" when omitted.
   */
  @IsOptional()
  @IsIn(['paragraph', 'markdown', 'sentence', 'off'])
  splitter?: 'paragraph' | 'markdown' | 'sentence' | 'off';
}
