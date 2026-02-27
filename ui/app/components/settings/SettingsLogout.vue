<script setup lang="ts">
const { t } = useI18n()
const { authMode, signOut } = useAuth()

async function handleLogout() {
  await signOut()
  navigateTo('/auth/login')
}
</script>

<template>
  <UCard 
    v-if="authMode !== 'miniApp'"
  >
    <template #header>
      <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('auth.logout') }}</h3>
    </template>
    <div class="flex items-center justify-between">
      <div>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ t('settings.logout_desc', 'Logout from your account on this device.') }}
        </p>
      </div>
      <UButton
        color="neutral"
        variant="solid"
        icon="i-heroicons-arrow-left-on-rectangle"
        @click="handleLogout"
      >
        {{ t('auth.logout') }}
      </UButton>
    </div>
  </UCard>
</template>
