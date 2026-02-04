<script setup lang="ts">
const { t } = useI18n()
const { displayName, authMode, isAdmin, user } = useAuth()

const { mobileBack } = usePageChrome()

const emit = defineEmits<{
  toggleSidebar: []
}>()
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between h-16 px-3 sm:px-4 md:px-6">
      <!-- Left side: Mobile back OR Mobile menu + Logo -->
      <div class="flex items-center gap-2 sm:gap-4">
        <UButton
          v-if="mobileBack.visible"
          variant="ghost"
          color="neutral"
          icon="i-heroicons-arrow-left"
          class="lg:hidden touch-target p-1 sm:p-2"
          @click="mobileBack.onClick"
        >
          {{ mobileBack.label }}
        </UButton>

        <template v-else>
          <!-- Mobile menu button -->
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-bars-3"
            class="lg:hidden touch-target p-1 sm:p-2"
            @click="emit('toggleSidebar')"
          />

          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2">
            <span class="hidden min-[360px]:inline text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Gran Publicador</span>
          </NuxtLink>
        </template>
      </div>

      <!-- Search: Left aligned (after logo/sidebar) -->
      <div class="hidden lg:block w-lg ml-8">
        <CommonGlobalSearch />
      </div>

      <div class="flex-1"></div>

      <!-- Right side: Create button and User avatar -->
      <div class="flex items-center gap-2 sm:gap-3">
        <template v-if="mobileBack.visible">
          <CommonGlobalSearch :disable-shortcut="true" variant="icon" class="touch-target" />
          <CommonNotificationsNotificationBell class="touch-target" />
        </template>

        <template v-else>
          <CommonGlobalCreateButton class="hidden lg:block" />

          <CommonGlobalSearch :disable-shortcut="true" variant="icon" class="lg:hidden touch-target" />

          <CommonNotificationsNotificationBell class="touch-target" />

          <UTooltip :text="t('navigation.settings')">
            <UButton
              to="/settings"
              variant="ghost"
              color="neutral"
              class="p-0.5 rounded-full touch-target"
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
        </template>
      </div>
    </div>

    <!-- Auth mode badge (dev only) -->
    <div
      v-if="authMode === 'dev'"
      class="bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800 px-3 sm:px-4 py-1"
    >
      <div class="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-400">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 shrink-0" />
        <span class="truncate">{{ t('auth.devMode') }} — Telegram ID: {{ user?.telegramId }}</span>
        <span
          v-if="isAdmin"
          class="ml-2 px-1.5 py-0.5 rounded bg-yellow-200 dark:bg-yellow-800 font-medium whitespace-nowrap"
        >
          {{ t('user.isAdmin') }}
        </span>
      </div>
    </div>
  </header>
</template>
