import type { Ref } from 'vue';
import { logger } from '~/utils/logger';

export interface ApiActionOptions {
  loadingRef?: Ref<boolean>;
  errorRef?: Ref<string | null>;
  successMessage?: string;
  errorMessage?: string;
  silentErrors?: boolean;
  throwOnError?: boolean;
}

export function useApiAction() {
  const nuxtApp = useNuxtApp();

  const isRequestAbortedError = (err: any): boolean => {
    const message = String(err?.message || '');
    const name = String(err?.name || '');
    return name === 'AbortError' || message === 'Request aborted';
  };

  const executeAction = async <T>(
    action: () => Promise<T>,
    options: ApiActionOptions = {},
  ): Promise<[Error | null, T | null]> => {
    if (options.loadingRef) options.loadingRef.value = true;
    if (options.errorRef) options.errorRef.value = null;

    // Lazy access to toast and i18n to support plugins/middleware where hooks might fail
    const t = (key: string, fb?: string): string => {
      if (nuxtApp.$i18n) return nuxtApp.$i18n.t(key);
      return fb || key;
    };

    const toast = nuxtApp.$toast as any;

    try {
      const result = await action();

      if (options.successMessage && toast) {
        toast.add({
          title: t('common.success', 'Success'),
          description: options.successMessage,
          color: 'success',
        });
      }

      return [null, result];
    } catch (err: any) {
      if (isRequestAbortedError(err)) {
        return [err, null];
      }

      logger.error('API Action Error', err);
      const message = err.message || options.errorMessage || 'An error occurred';

      if (options.errorRef) options.errorRef.value = message;

      if (!options.silentErrors && toast) {
        toast.add({
          title: t('common.error', 'Error'),
          description: message,
          color: 'error',
        });
      }

      if (options.throwOnError) {
        throw err;
      }

      return [err, null];
    } finally {
      if (options.loadingRef) options.loadingRef.value = false;
    }
  };

  return { executeAction };
}
