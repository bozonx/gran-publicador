<script setup lang="ts">
const { t } = useI18n()
const { user, telegramUser, isAuthenticated, isAdmin, isDevMode, isLoading, error, initialize } =
  useAuth()

// Initialize auth on mount
onMounted(async () => {
  if (!isAuthenticated.value) {
    await initialize()
  }
})
</script>

<template>
  <UiCard title="Authentication Status" variant="bordered">
    <div class="space-y-3">
      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center gap-2 text-gray-500">
        <UIcon name="i-lucide-loader-2" class="animate-spin" />
        <span>{{ t('common.loading') }}</span>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="text-red-600">
        <p class="font-medium">{{ t('common.error') }}</p>
        <p class="text-sm">{{ error }}</p>
      </div>

      <!-- Authenticated state -->
      <template v-else-if="isAuthenticated">
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
            {{ t('auth.profile') }}
          </span>
          <span
            v-if="isAdmin"
            class="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded-full"
          >
            {{ t('user.isAdmin') }}
          </span>
          <span
            v-if="isDevMode"
            class="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full"
          >
            Dev Mode
          </span>
        </div>

        <div class="text-sm space-y-1">
          <p>
            <span class="text-gray-500">{{ t('user.telegramId') }}:</span>
            <span class="font-mono ml-1">{{ user?.telegram_id }}</span>
          </p>
          <p v-if="user?.full_name">
            <span class="text-gray-500">{{ t('user.displayName') }}:</span>
            <span class="ml-1">{{ user.full_name }}</span>
          </p>
          <p v-if="telegramUser?.username">
            <span class="text-gray-500">{{ t('user.username') }}:</span>
            <span class="ml-1">@{{ telegramUser.username }}</span>
          </p>
          <p>
            <span class="text-gray-500">ID:</span>
            <span class="font-mono text-xs ml-1">{{ user?.id }}</span>
          </p>
        </div>
      </template>

      <!-- Not authenticated -->
      <div v-else class="text-gray-500">
        <p>{{ t('auth.notAuthenticated') }}</p>
        <UiButton variant="primary" size="sm" class="mt-2" @click="initialize">
          {{ t('auth.login') }}
        </UiButton>
      </div>
    </div>
  </UiCard>
</template>
