// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  modules: [
    '@nuxt/ui',
    '@nuxt/icon',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    '@vueuse/nuxt',
    ...(process.env.NODE_ENV === 'test' ? ['@nuxt/test-utils/module'] : []),
  ],

  i18n: {
    locales: [
      { code: 'ru-RU', name: 'Русский', file: 'ru-RU.json', iso: 'ru-RU' },
      { code: 'en-US', name: 'English', file: 'en-US.json', iso: 'en-US' },
    ],
    defaultLocale: 'en-US',
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
  },

  future: {
    compatibilityVersion: 4,
  },

  css: ['~/assets/css/main.css'],

  ssr: false,

  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    pageTransition: false,
    layoutTransition: false,
    head: {
      title: 'Gran Publicador',
      viewport: 'width=device-width, initial-scale=1',
      meta: [{ name: 'theme-color', content: '#000000' }],
      script: [{ src: 'https://telegram.org/js/telegram-web-app.js' }],
    },
  },

  experimental: {
    viewTransition: false,
  },

  runtimeConfig: {
    public: {
      devMode: process.env.NUXT_PUBLIC_DEV_MODE || 'false',
      devTelegramId: process.env.NUXT_PUBLIC_DEV_TELEGRAM_ID || '',
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '',
      telegramBotName: process.env.NUXT_PUBLIC_TELEGRAM_BOT_NAME || 'gran_publicador_bot',
      newsServiceUrl:
        process.env.NUXT_PUBLIC_NEWS_SERVICE_URL || process.env.NEWS_SERVICE_URL || '',
    },
  },

  components: [
    {
      path: '~/components',
      pathPrefix: true,
    },
  ],

  devtools: { enabled: true },
});
