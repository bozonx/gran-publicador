export interface AuthProviderResult {
  telegramId: bigint;
  username?: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  languageCode?: string;
}
