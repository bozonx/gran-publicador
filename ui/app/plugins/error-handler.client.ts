import { logger } from '~/utils/logger';

export default defineNuxtPlugin(nuxtApp => {
  const toast = useToast();
  const { t } = useI18n();
  const authStore = useAuthStore();

  const handleFatalError = (error: unknown, context: string) => {
    logger.error(context, error);

    if (import.meta.client) {
      toast.add({
        title: t('common.error'),
        description: t('common.unexpectedError'),
        color: 'error',
      });
    }
  };

  nuxtApp.hook('vue:error', (error, instance, info) => {
    handleFatalError(error, `Vue error: ${info || 'unknown'}`);
  });

  if (import.meta.client) {
    window.addEventListener('unhandledrejection', event => {
      handleFatalError(event.reason, 'Unhandled promise rejection');
    });

    window.addEventListener('error', event => {
      handleFatalError(event.error || event.message, 'Global error');
    });

    window.addEventListener('auth:session-expired', () => {
      toast.add({
        title: t('auth.sessionExpiredTitle'),
        description: t('auth.sessionExpiredDescription'),
        color: 'warning',
      });

      authStore.logout();
    });
  }
});
