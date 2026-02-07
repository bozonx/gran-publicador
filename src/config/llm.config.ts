import { plainToClass } from 'class-transformer';
import { IsInt, Min, Max, IsString, IsUrl, IsOptional, IsIn } from 'class-validator';
import { registerAs } from '@nestjs/config';

/**
 * Configuration for Free LLM Router microservice integration.
 */
export class LlmConfig {
  /**
   * URL of the Free LLM Router microservice.
   * Defined by FREE_LLM_ROUTER_URL environment variable.
   * Example: http://localhost:8080/api/v1
   */
  @IsString()
  @IsUrl({ require_tld: false })
  public serviceUrl!: string;

  /**
   * API Token for Bearer authorization (optional).
   */
  @IsOptional()
  @IsString()
  public apiToken?: string;

  /**
   * Default tags for model selection.
   * Defined by FREE_LLM_ROUTER_TAGS environment variable.
   * Example: fast,best-for-ru
   */
  @IsOptional()
  public defaultTags?: string[];

  /**
   * Default model type: "fast" or "reasoning".
   * Defined by FREE_LLM_ROUTER_TYPE environment variable.
   */
  @IsOptional()
  @IsIn(['fast', 'reasoning'])
  public defaultType?: 'fast' | 'reasoning';

  /**
   * Maximum model switches per request.
   * Defined by FREE_LLM_ROUTER_MAX_MODEL_SWITCHES environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxModelSwitches?: number;

  /**
   * Maximum retries on the same model.
   * Defined by FREE_LLM_ROUTER_MAX_SAME_MODEL_RETRIES environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  public maxSameModelRetries?: number;

  /**
   * Retry delay in milliseconds.
   * Defined by FREE_LLM_ROUTER_RETRY_DELAY environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  public retryDelay?: number;

  /**
   * Request timeout in seconds.
   * Defined by FREE_LLM_ROUTER_TIMEOUT_SECS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutSecs?: number;

  /**
   * Fallback provider.
   * Defined by FREE_LLM_ROUTER_FALLBACK_PROVIDER environment variable.
   */
  @IsOptional()
  @IsString()
  public fallbackProvider?: string;

  /**
   * Fallback model.
   * Defined by FREE_LLM_ROUTER_FALLBACK_MODEL environment variable.
   */
  @IsOptional()
  @IsString()
  public fallbackModel?: string;

  /**
   * Minimum context size.
   * Defined by FREE_LLM_ROUTER_MIN_CONTEXT_SIZE environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public minContextSize?: number;

  /**
   * Minimum max output tokens.
   * Defined by FREE_LLM_ROUTER_MIN_MAX_OUTPUT_TOKENS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public minMaxOutputTokens?: number;
}

export default registerAs('llm', (): LlmConfig => {
  const rawConfig: any = {
    serviceUrl: process.env.FREE_LLM_ROUTER_URL || 'http://localhost:8080/api/v1',
    apiToken: process.env.FREE_LLM_ROUTER_API_TOKEN,
    defaultTags: process.env.FREE_LLM_ROUTER_TAGS?.split(',').map(t => t.trim()),
    defaultType: process.env.FREE_LLM_ROUTER_TYPE as 'fast' | 'reasoning' | undefined,
    maxModelSwitches: process.env.FREE_LLM_ROUTER_MAX_MODEL_SWITCHES
      ? parseInt(process.env.FREE_LLM_ROUTER_MAX_MODEL_SWITCHES, 10)
      : undefined,
    maxSameModelRetries: process.env.FREE_LLM_ROUTER_MAX_SAME_MODEL_RETRIES
      ? parseInt(process.env.FREE_LLM_ROUTER_MAX_SAME_MODEL_RETRIES, 10)
      : undefined,
    retryDelay: process.env.FREE_LLM_ROUTER_RETRY_DELAY
      ? parseInt(process.env.FREE_LLM_ROUTER_RETRY_DELAY, 10)
      : undefined,
    timeoutSecs: process.env.FREE_LLM_ROUTER_TIMEOUT_SECS
      ? parseInt(process.env.FREE_LLM_ROUTER_TIMEOUT_SECS, 10)
      : undefined,
    fallbackProvider: process.env.FREE_LLM_ROUTER_FALLBACK_PROVIDER,
    fallbackModel: process.env.FREE_LLM_ROUTER_FALLBACK_MODEL,
    minContextSize: process.env.FREE_LLM_ROUTER_MIN_CONTEXT_SIZE
      ? parseInt(process.env.FREE_LLM_ROUTER_MIN_CONTEXT_SIZE, 10)
      : undefined,
    minMaxOutputTokens: process.env.FREE_LLM_ROUTER_MIN_MAX_OUTPUT_TOKENS
      ? parseInt(process.env.FREE_LLM_ROUTER_MIN_MAX_OUTPUT_TOKENS, 10)
      : undefined,
  };

  // Remove undefined and NaN values to let class defaults take over
  Object.keys(rawConfig).forEach(key => {
    const value = rawConfig[key];
    if (value === undefined || (typeof value === 'number' && isNaN(value))) {
      delete rawConfig[key];
    }
  });

  const config = plainToClass(LlmConfig, rawConfig);

  return config;
});
