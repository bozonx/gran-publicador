import { computed } from 'vue';

export const useAuth = () => {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const devModeRaw = config.public.devMode;
  const isDevMode = ['true', '1', 'yes', 'on'].includes(String(devModeRaw));

  return {
    user: computed(() => authStore.user),
    isLoading: computed(() => authStore.isLoading),
    isInitialized: computed(() => authStore.isInitialized),
    error: computed(() => authStore.error),
    isAuthenticated: computed(() => authStore.isLoggedIn),
    isAdmin: computed(() => authStore.isAdmin),
    isSuperAdmin: computed(() => authStore.isSuperAdmin),
    displayName: computed(() => authStore.displayName),
    authMode: computed(() => {
      if (isDevMode) return 'dev';
      // @ts-ignore
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return 'miniApp';
      return 'browser';
    }),

    loginWithTelegram: authStore.loginWithTelegram,
    loginWithTelegramWidget: authStore.loginWithTelegramWidget,
    loginWithDev: authStore.loginWithDev,
    signOut: authStore.logout,
    refreshUser: authStore.fetchMe,
    initialize: authStore.fetchMe,
  };
};
