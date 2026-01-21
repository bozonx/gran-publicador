import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../../../generated/prisma/client.js';
import { VALIDATION_LIMITS } from '../../../common/constants/validation.constants.js';

export class NotificationFilterDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRead?: boolean;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_PAGE_LIMIT)
  @Max(VALIDATION_LIMITS.MAX_PAGE_LIMIT)
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(VALIDATION_LIMITS.MIN_OFFSET)
  @Type(() => Number)
  offset?: number;
}
