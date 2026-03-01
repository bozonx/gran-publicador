import type { UserWithStats } from '~/stores/users';

export function getUserDisplayName(user: UserWithStats): string {
  return (
    user.fullName || user.telegramUsername || user.full_name || user.telegram_username || 'User'
  );
}

export function getUserInitials(user: UserWithStats): string {
  const name = getUserDisplayName(user);
  return name.slice(0, 2).toUpperCase();
}

export function useUserUi() {
  return {
    getUserDisplayName,
    getUserInitials,
  };
}
