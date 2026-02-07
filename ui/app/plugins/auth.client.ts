import { logger } from '~/utils/logger';

export default defineNuxtPlugin(async () => {
  const { authMode, loginWithDev, loginWithTelegram, isAuthenticated, initialize } = useAuth();

  await initialize();

  if (isAuthenticated.value) return;

  if (authMode.value === 'dev') {
    logger.info('Dev mode: attempting auto-login');
    try {
      await loginWithDev();
      logger.info('Dev mode: auto-login successful');
    } catch (e) {
      logger.error('Dev mode: auto-login failed', e);
    }

    return;
  }

  if (authMode.value === 'miniApp') {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (!tg?.initData) return;

    logger.info('Mini App mode: attempting auto-login');
    try {
      await loginWithTelegram(tg.initData);
      logger.info('Mini App mode: auto-login successful');
    } catch (e) {
      logger.error('Mini App mode: auto-login failed', e);
    }
  }
});
