import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { logger } from '~/utils/logger';

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

interface AuthResponse {
  user: User;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const api = useApi();

  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isInitialized = ref(false);

  const isLoggedIn = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.isAdmin === true);
  const isSuperAdmin = computed(() => user.value?.isSuperAdmin === true);
  const displayName = computed(() => {
    if (user.value?.fullName) return user.value.fullName;
    if (user.value?.telegramUsername) return user.value.telegramUsername;
    return 'User';
  });

  async function loginWithTelegram(initData: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await api.post<AuthResponse>('/auth/telegram', {
        initData,
      });

      user.value = response.user;
      isInitialized.value = true;

      return response;
    } catch (err: any) {
      error.value = err.message;
      logger.error('Login failed', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function loginWithTelegramWidget(widgetData: any) {
    isLoading.value = true;
    error.value = null;
    try {
      const response = await api.post<AuthResponse>('/auth/telegram-widget', widgetData);

      user.value = response.user;
      isInitialized.value = true;

      return response;
    } catch (err: any) {
      error.value = err.message;
      logger.error('Widget login failed', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function loginWithDev() {
    isLoading.value = true;
    error.value = null;
    try {
      const config = useRuntimeConfig();
      const devTelegramId = config.public.devTelegramId;

      if (!devTelegramId) {
        throw new Error('NUXT_PUBLIC_DEV_TELEGRAM_ID not set');
      }

      const response = await api.post<AuthResponse>('/auth/dev', {
        telegramId: Number(devTelegramId),
      });

      user.value = response.user;
      isInitialized.value = true;

      return response;
    } catch (err: any) {
      error.value = err.message;
      logger.error('Dev login failed', err);
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    user.value = null;
    try {
      await api.post('/auth/logout', undefined);
    } catch {
      // noop
    }
    navigateTo('/auth/login');
  }

  async function fetchMe() {
    isLoading.value = true;
    try {
      const userData = await api.get<User>('/auth/me');
      user.value = userData;
      isInitialized.value = true;
      return userData;
    } catch (err) {
      logger.error('Fetch me failed', err);
      user.value = null;
    } finally {
      isLoading.value = false;
      isInitialized.value = true;
    }
  }

  return {
    user,
    isLoading,
    isInitialized,
    error,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    displayName,
    loginWithTelegram,
    loginWithTelegramWidget,
    loginWithDev,
    logout,
    fetchMe,
  };
});
