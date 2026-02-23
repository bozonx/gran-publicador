import { plainToClass } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { registerAs } from '@nestjs/config';

export class UnsplashConfig {
  /**
   * Single request timeout in seconds.
   * Defined by UNSPLASH_REQUEST_TIMEOUT_SECS environment variable.
   * Default: 30
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public requestTimeoutSecs: number = 30;
}

export default registerAs('unsplash', (): UnsplashConfig => {
  const config = plainToClass(UnsplashConfig, {
    requestTimeoutSecs: process.env.UNSPLASH_REQUEST_TIMEOUT_SECS
      ? parseInt(process.env.UNSPLASH_REQUEST_TIMEOUT_SECS, 10)
      : 30,
  });

  return config;
});
