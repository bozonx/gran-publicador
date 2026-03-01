import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import { useAppStore } from '~/stores/app';
import { useNotificationsStore } from '~/stores/notifications';
import { useDashboardStore } from '~/stores/dashboard';
import { useUsersStore } from '~/stores/users';
import { useProjectsStore } from '~/stores/projects';
import { useSttStore } from '~/stores/stt';
import { useChannelsStore } from '~/stores/channels';
import { usePublicationsStore } from '~/stores/publications';
import { usePostsStore } from '~/stores/posts';
import { useNewsStore } from '~/stores/news';
import { useMediaStore } from '~/stores/media';
import type { User, AuthResponse } from '~/types/user';
import { logger } from '~/utils/logger';

export const useAuth = () => {
  const store = useAuthStore();
  const { user, isLoading, error, isInitialized, isLoggedIn, isAdmin, isSuperAdmin, displayName } = storeToRefs(store);
  const api = useApi();
  const { executeAction } = useApiAction();
  const config = useRuntimeConfig();

  // Helper bindings for store state to be used with executeAction
  const loadingBinding = computed({
    get: () => isLoading.value,
    set: (val) => store.setLoading(val)
  });
  const errorBinding = computed({
    get: () => error.value,
    set: (val) => store.setError(val)
  });

  const devModeRaw = config.public.devMode;
  const isDevMode = ['true', '1', 'yes', 'on'].includes(String(devModeRaw));

  async function loginWithTelegram(initData: string) {
    const [, response] = await executeAction(
      async () => {
        const res = await api.post<AuthResponse>('/auth/telegram', { initData });
        store.setUser(res.user);
        store.setInitialized(true);
        return res;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return response;
  }

  async function loginWithTelegramWidget(widgetData: any) {
    const [, response] = await executeAction(
      async () => {
        const res = await api.post<AuthResponse>('/auth/telegram-widget', widgetData);
        store.setUser(res.user);
        store.setInitialized(true);
        return res;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return response;
  }

  async function loginWithDev() {
    const [, response] = await executeAction(
      async () => {
        const devTelegramId = config.public.devTelegramId;
        if (!devTelegramId) {
          throw new Error('NUXT_PUBLIC_DEV_TELEGRAM_ID not set');
        }
        const res = await api.post<AuthResponse>('/auth/dev', {
          telegramId: Number(devTelegramId),
        });
        store.setUser(res.user);
        store.setInitialized(true);
        return res;
      },
      { loadingRef: loadingBinding, errorRef: errorBinding }
    );
    return response;
  }

  async function signOut() {
    try {
      await api.post('/auth/logout', undefined);
    } catch {
      // noop
    }
    
    // Reset all stores
    store.reset();
    useAppStore().reset();
    useNotificationsStore().reset();
    useDashboardStore().reset();
    useUsersStore().reset();
    useProjectsStore().reset();
    useSttStore().reset();
    useChannelsStore().reset();
    usePublicationsStore().reset();
    usePostsStore().reset();
    useNewsStore().reset();
    useMediaStore().reset();
    
    navigateTo('/auth/login');
  }

  async function fetchMe() {
    const [, userData] = await executeAction(
      async () => {
        const data = await api.get<User>('/auth/me');
        store.setUser(data);
        store.setInitialized(true);
        return data;
      },
      { 
        loadingRef: loadingBinding, 
        silentErrors: true // For startup fetch, errors (401) are expected/normal
      }
    );

    if (!userData) {
      store.setUser(null);
      store.setInitialized(true);
    }
    
    return userData;
  }

  return {
    user,
    isLoading,
    isInitialized,
    error,
    isAuthenticated: isLoggedIn,
    isAdmin,
    isSuperAdmin,
    displayName,
    authMode: computed(() => {
      if (isDevMode) return 'dev';
      // @ts-ignore
      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) return 'miniApp';
      return 'browser';
    }),

    loginWithTelegram,
    loginWithTelegramWidget,
    loginWithDev,
    signOut,
    refreshUser: fetchMe,
    initialize: fetchMe,
  };
};
