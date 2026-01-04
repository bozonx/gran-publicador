import { computed } from 'vue';

export const useAuth = () => {
    const authStore = useAuthStore();
    const config = useRuntimeConfig();

    return {
        user: computed(() => authStore.user),
        isLoading: computed(() => authStore.isLoading),
        isInitialized: computed(() => authStore.isInitialized),
        error: computed(() => authStore.error),
        isAuthenticated: computed(() => authStore.isLoggedIn),
        isAdmin: computed(() => authStore.isAdmin),
        displayName: computed(() => authStore.displayName),
        authMode: computed(() => {
            if (config.public.devMode === 'true') return 'dev'
            // @ts-ignore
            if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return 'miniApp'
            return 'browser'
        }),

        loginWithTelegram: authStore.loginWithTelegram,
        loginWithTelegramWidget: authStore.loginWithTelegramWidget,
        loginWithDev: authStore.loginWithDev,
        signOut: authStore.logout,
        refreshUser: authStore.fetchMe,
        initialize: authStore.fetchMe,
    };
};
