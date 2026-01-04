/**
 * Telegram Mini App SDK initialization plugin
 * Runs only on client side
 */
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const isDevMode = String(config.public.devMode) === 'true'

  // In dev mode, skip Telegram SDK initialization
  if (isDevMode) {
    // eslint-disable-next-line no-console
    console.info('[Telegram] Dev mode enabled, skipping SDK initialization')
    return
  }

  // Only initialize in Telegram WebApp environment
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    try {
      const webApp = window.Telegram.WebApp
      webApp.ready()
      webApp.expand()
      // eslint-disable-next-line no-console
      console.info('[Telegram] WebApp initialized')
    } catch (error) {
      console.error('[Telegram] Failed to initialize WebApp:', error)
    }
  }
})
