<script setup lang="ts">
import { nextTick } from 'vue'
import { logger } from '~/utils/logger'

definePageMeta({
  layout: 'auth',
})

const { t } = useI18n()
const { loginWithTelegram, loginWithTelegramWidget, loginWithDev, isLoading, error, isAuthenticated } = useAuth()
const config = useRuntimeConfig()
const router = useRouter()

const isDev = config.public.devMode === 'true'
const isTelegramContent = ref(true)
const widgetContainer = ref<HTMLElement | null>(null)

const onTelegramAuth = async (user: any) => {
  try {
    await loginWithTelegramWidget(user)
    router.push('/')
  } catch (e) {
    logger.error('Widget login failed', e)
  }
}

const loadWidget = async () => {
  if (!process.client) return
  
  // A small delay often helps with Telegram widget rendering in SPAs
  await new Promise(resolve => setTimeout(resolve, 100))
  await nextTick()
  
  if (widgetContainer.value) {
    const botName = config.public.telegramBotName
     
    
    // Clear container
    widgetContainer.value.innerHTML = ''
    
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', botName as string)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    
    // @ts-ignore
    window.onTelegramAuth = onTelegramAuth
    
    widgetContainer.value.appendChild(script)
  }
}

// Watch for the DOM element directly
watch(widgetContainer, (el) => {
  if (el) {
    loadWidget()
  }
})

onMounted(async () => {
  // If already logged in, go to home
  if (isAuthenticated.value) {
    router.push('/')
    return
  }

  // @ts-ignore
  const tg = window.Telegram?.WebApp
  
  // @ts-ignore
  window.onTelegramAuth = onTelegramAuth

  if (tg?.initData) {
     try {
       await loginWithTelegram(tg.initData)
       router.push('/')
     } catch (e) {
       logger.error('Mini App login failed', e)
       isTelegramContent.value = false
     }
  } else if (isDev) {
     try {
       await loginWithDev()
       router.push('/')
     } catch (e) {
       logger.error('Dev login failed', e)
       isTelegramContent.value = false
     }
  } else {
    isTelegramContent.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- Minimal header with logo and language switcher -->
    <header class="w-full py-4 px-4 sm:px-6">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <span class="text-xl font-bold text-gray-900 dark:text-white">Gran Publicador</span>
        </NuxtLink>

        <!-- Language switcher -->
        <UiLanguageSwitcher />
      </div>
    </header>

    <!-- Main content -->
    <div class="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div class="max-w-md w-full space-y-8 text-center">
        <!-- Title -->
        <div>
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ t('auth.login') || 'Login' }}
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ t('auth.loginDescription') || 'Sign in to your account' }}
          </p>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center space-y-4">
          <UiLoadingSpinner size="lg" color="primary" :label="t('auth.loggingIn') || 'Authenticating...'" centered />
        </div>

        <!-- Error Message -->
        <UAlert
          v-if="error"
          class="mb-6"
          color="error"
          variant="soft"
          icon="i-heroicons-exclamation-triangle"
          :title="t('common.error')"
          :description="String(error)"
        />

        <!-- Telegram Login Widget Container -->
        <div v-if="!isLoading && !isTelegramContent" class="space-y-6">
          <div class="bg-white dark:bg-gray-800 p-10 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
            <!-- Only the official widget should be here -->
            <div class="flex flex-col items-center justify-center min-h-[100px]">
              <div ref="widgetContainer" class="telegram-widget-container"></div>
              
              <!-- Show a subtle hint only AFTER we attempt to load -->
              <p class="mt-8 text-sm text-gray-500 dark:text-gray-400">
                {{ t('auth.widgetHint') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.telegram-widget-container :deep(iframe) {
  margin: 0 auto !important;
}
</style>
