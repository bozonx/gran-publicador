<script setup lang="ts">
const { t } = useI18n()
const { displayName, authMode, isAdmin, user } = useAuth()

const emit = defineEmits<{
  toggleSidebar: []
}>()
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between h-16 px-4 sm:px-6">
      <!-- Left side: Mobile menu button + Logo -->
      <div class="flex items-center gap-4">
        <!-- Mobile menu button -->
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-heroicons-bars-3"
          class="lg:hidden"
          @click="emit('toggleSidebar')"
        />

        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <span class="text-xl font-bold text-gray-900 dark:text-white"> Gran Publicador </span>
        </NuxtLink>
      </div>

      <!-- Search: Left aligned (after logo/sidebar) -->
      <div class="hidden sm:block w-lg ml-8">
        <CommonGlobalSearch />
      </div>

      <div class="flex-1"></div>

      <!-- Right side: Create button and User avatar -->
      <div class="flex items-center gap-3">
        <CommonGlobalCreateButton class="hidden lg:block" />
        
        <CommonGlobalSearch :disable-shortcut="true" class="sm:hidden" />

        <UTooltip :text="t('navigation.settings')">
          <UButton
            to="/settings"
            variant="ghost"
            color="neutral"
            class="p-0.5 rounded-full"
          >
            <UAvatar
              :src="user?.avatarUrl || undefined"
              :alt="displayName"
              size="sm"
              :ui="{
                fallback:
                  'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300',
              }"
            />
          </UButton>
        </UTooltip>
      </div>
    </div>

    <!-- Auth mode badge (dev only) -->
    <div
      v-if="authMode === 'dev'"
      class="bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 px-4 py-1"
    >
      <div class="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />
        <span>{{ t('auth.devMode') }} — Telegram ID: {{ user?.telegramId }}</span>
        <span
          v-if="isAdmin"
          class="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 font-medium"
        >
          {{ t('user.isAdmin') }}
        </span>
      </div>
    </div>
  </header>
</template>
