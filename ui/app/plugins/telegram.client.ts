/**
 * Telegram Mini App SDK initialization plugin
 * Runs only on client side
 */
import { logger } from '~/utils/logger';

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig();
  const isDevMode = String(config.public.devMode) === 'true';

  // In dev mode, skip Telegram SDK initialization
  if (isDevMode) {
    logger.info('Telegram: dev mode enabled, skipping SDK initialization');
    return;
  }

  // Only initialize in Telegram WebApp environment
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    try {
      const webApp = window.Telegram.WebApp;
      webApp.ready();
      webApp.expand();

      logger.info('Telegram: WebApp initialized');
    } catch (error) {
      logger.error('Telegram: failed to initialize WebApp', error);
    }
  }
});
