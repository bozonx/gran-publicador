import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

export interface User {
    id: string;
    telegramId?: string; // Backend sends string for BigInt
    telegramUsername?: string;
    fullName?: string;
    avatarUrl?: string;

    isAdmin: boolean;
    createdAt?: string;
    updatedAt?: string;
}

interface AuthResponse {
    accessToken: string;
    user: User;
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const token = useCookie('auth_token');
    const api = useApi();

    const isLoading = ref(false);
    const error = ref<string | null>(null);
    const isInitialized = ref(false);

    const isLoggedIn = computed(() => !!user.value);
    const isAdmin = computed(() => user.value?.isAdmin === true);
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

            token.value = response.accessToken;
            user.value = response.user;
            isInitialized.value = true;

            return response;
        } catch (err: any) {
            error.value = err.message;
            console.error('Login failed', err);
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

            token.value = response.accessToken;
            user.value = response.user;
            isInitialized.value = true;

            return response;
        } catch (err: any) {
            error.value = err.message;
            console.error('Widget login failed', err);
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
                throw new Error('VITE_DEV_TELEGRAM_ID not set');
            }

            const response = await api.post<AuthResponse>('/auth/dev', {
                telegramId: Number(devTelegramId),
            });

            token.value = response.accessToken;
            user.value = response.user;
            isInitialized.value = true;

            return response;
        } catch (err: any) {
            error.value = err.message;
            console.error('Dev login failed', err);
            throw err;
        } finally {
            isLoading.value = false;
        }
    }

    async function logout() {
        user.value = null;
        token.value = null;
        navigateTo('/auth/login');
    }

    async function fetchMe() {
        if (!token.value) {
            isInitialized.value = true;
            return null;
        }

        isLoading.value = true;
        try {
            const userData = await api.get<User>('/auth/me');
            user.value = userData;
            isInitialized.value = true;
            return userData;
        } catch (err) {
            console.error('Fetch me failed', err);
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
        displayName,
        loginWithTelegram,
        loginWithTelegramWidget,
        loginWithDev,
        logout,
        fetchMe,
    };
});
