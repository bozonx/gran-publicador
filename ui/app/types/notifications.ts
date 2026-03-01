export enum NotificationType {
  PUBLICATION_FAILED = 'PUBLICATION_FAILED',
  PROJECT_INVITE = 'PROJECT_INVITE',
  SYSTEM = 'SYSTEM',
  NEW_NEWS = 'NEW_NEWS',
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  meta: any;
  readAt: string | null;
  createdAt: string;
}

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
