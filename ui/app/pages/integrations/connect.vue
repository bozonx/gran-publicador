<script setup lang="ts">
import { useApiTokens } from '~/composables/useApiTokens'

definePageMeta({
  middleware: 'auth',
  layout: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { createToken, loading, error: tokenError } = useApiTokens()

// Parameters from URL
const appName = computed(() => (route.query.name as string) || 'External App')
const redirectUri = computed(() => route.query.redirect_uri as string)

const isSuccess = ref(false)
const localError = ref<string | null>(null)

const combinedError = computed(() => localError.value || tokenError.value)

async function handleAllow() {
  if (!redirectUri.value) {
    localError.value = t('externalIntegrations.connect.invalidRedirect')
    return
  }

  try {
    localError.value = null
    // Create a new API token for this application
    const token = await createToken({
      name: `Integration: ${appName.value}`,
      expiresAt: null, // Perpetual token for the app
    })

    isSuccess.value = true

    // Wait a bit to show success message
    setTimeout(() => {
      const url = new URL(redirectUri.value)
      url.searchParams.append('token', token.token)
      window.location.href = url.toString()
    }, 1500)
  } catch (err: any) {
    console.error('Failed to authorize application', err)
  }
}

function handleDeny() {
  if (redirectUri.value) {
    const url = new URL(redirectUri.value)
    url.searchParams.append('error', 'access_denied')
    window.location.href = url.toString()
  } else {
    router.push('/')
  }
}

onMounted(() => {
  if (!redirectUri.value) {
    localError.value = t('externalIntegrations.connect.invalidRedirect')
  }
})
</script>

<template>
  <div class="max-w-md w-full space-y-8">
    <!-- Header -->
    <div class="text-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ t('externalIntegrations.connect.title') }}
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {{ t('externalIntegrations.connect.description') }}
      </p>
    </div>

    <!-- App Info Card -->
    <div class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
      <div class="flex flex-col items-center mb-6">
        <div class="w-16 h-16 bg-primary-100 dark:bg-primary-900 flex items-center justify-center rounded-2xl mb-4">
          <UIcon name="i-heroicons-cpu-chip" class="w-10 h-10 text-primary-600 dark:text-primary-400" />
        </div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
          {{ appName }}
        </h2>
      </div>

      <div class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-300" v-html="t('externalIntegrations.connect.wantsAccessTo', { appName })"></p>
        
        <ul class="space-y-3">
          <li class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
            <span>{{ t('externalIntegrations.connect.vfsAccess') }}</span>
          </li>
          <li class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
            <span>{{ t('externalIntegrations.connect.sttAccess') }}</span>
          </li>
          <li class="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
            <UIcon name="i-heroicons-check-circle" class="w-5 h-5 text-green-500 shrink-0" />
            <span>{{ t('externalIntegrations.connect.llmAccess') }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Feedback States -->
    <div v-if="isSuccess" class="flex flex-col items-center space-y-2">
      <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-500 animate-bounce" />
      <p class="text-sm font-medium text-green-600 dark:text-green-400">
        {{ t('externalIntegrations.connect.success') }}
      </p>
    </div>

    <UAlert
      v-if="combinedError"
      color="error"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
      :title="t('externalIntegrations.connect.error')"
      :description="String(combinedError)"
    />

    <!-- Actions -->
    <div v-if="!isSuccess" class="flex flex-col gap-3">
      <UButton
        size="lg"
        block
        :loading="loading"
        :disabled="!!localError"
        @click="handleAllow"
      >
        {{ t('externalIntegrations.connect.allow') }}
      </UButton>
      <UButton
        size="lg"
        variant="ghost"
        color="gray"
        block
        @click="handleDeny"
      >
        {{ t('externalIntegrations.connect.deny') }}
      </UButton>
    </div>
  </div>
</template>
