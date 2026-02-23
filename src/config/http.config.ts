import { plainToClass } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { registerAs } from '@nestjs/config';

export class HttpConfig {
  @IsInt()
  @Min(1)
  public retryMaxAttempts!: number;

  @IsInt()
  @Min(0)
  public retryInitialDelayMs!: number;

  @IsInt()
  @Min(0)
  public retryMaxDelayMs!: number;
}

export default registerAs('http', (): HttpConfig => {
  const config = plainToClass(HttpConfig, {
    retryMaxAttempts: parseInt(process.env.HTTP_RETRY_MAX_ATTEMPTS ?? '3', 10),
    retryInitialDelayMs: parseInt(process.env.HTTP_RETRY_INITIAL_DELAY_MS ?? '500', 10),
    retryMaxDelayMs: parseInt(process.env.HTTP_RETRY_MAX_DELAY_MS ?? '5000', 10),
  });

  return config;
});
