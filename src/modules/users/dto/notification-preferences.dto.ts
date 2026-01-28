import { IsBoolean, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificationType } from '../../../generated/prisma/index.js';

export class NotificationChannelPreferencesDto {
  @IsBoolean()
  @IsNotEmpty()
  internal!: boolean;

  @IsBoolean()
  @IsNotEmpty()
  telegram!: boolean;
}

export class NotificationPreferencesDto {
  @ValidateNested()
  @Type(() => NotificationChannelPreferencesDto)
  @IsNotEmpty()
  PUBLICATION_FAILED!: NotificationChannelPreferencesDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferencesDto)
  @IsNotEmpty()
  PROJECT_INVITE!: NotificationChannelPreferencesDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferencesDto)
  @IsNotEmpty()
  SYSTEM!: NotificationChannelPreferencesDto;

  @ValidateNested()
  @Type(() => NotificationChannelPreferencesDto)
  @IsNotEmpty()
  NEW_NEWS!: NotificationChannelPreferencesDto;
}

/**
 * Get default notification preferences.
 * Internal notifications are always enabled, Telegram notifications are enabled by default.
 */
export function getDefaultNotificationPreferences(): NotificationPreferencesDto {
  const defaultChannel: NotificationChannelPreferencesDto = {
    internal: true,
    telegram: true,
  };

  return {
    PUBLICATION_FAILED: { ...defaultChannel },
    PROJECT_INVITE: { ...defaultChannel },
    SYSTEM: { ...defaultChannel },
    NEW_NEWS: { ...defaultChannel },
  };
}
