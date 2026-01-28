export interface NotificationChannelPreferences {
  internal: boolean;
  telegram: boolean;
}

export interface NotificationPreferences {
  PUBLICATION_FAILED: NotificationChannelPreferences;
  PROJECT_INVITE: NotificationChannelPreferences;
  SYSTEM: NotificationChannelPreferences;
  NEW_NEWS: NotificationChannelPreferences;
}

export type NotificationType = keyof NotificationPreferences;
