import type { Database } from '~/types/database.types';

export type UserRow = Database['public']['Tables']['users']['Row'];

export interface User {
  id: string;
  telegramId?: string; // Backend sends string for BigInt
  telegramUsername?: string;
  fullName?: string;
  avatarUrl?: string;

  isAdmin: boolean;
  isSuperAdmin: boolean;
  language?: string;
  uiLanguage?: string;
  isUiLanguageAuto?: boolean;
  projectOrder?: string[];
  newsQueryOrder?: string[];
  videoAutoplay?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserWithStats extends User {
  projectsCount?: number;
  postsCount?: number;
  publicationsCount?: number;
  isBanned?: boolean;
  banReason?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preferences?: Record<string, any> | null;
}

export interface AuthResponse {
  user: User;
}

export interface UsersFilter {
  is_admin?: boolean | null;
  search?: string;
}

export interface UsersPaginationOptions {
  page: number;
  limit: number;
}
