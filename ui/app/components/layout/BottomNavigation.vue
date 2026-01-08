<script setup lang="ts">
const { t } = useI18n()

const navItems = computed(() => [
  {
    label: t('navigation.dashboard'),
    to: '/',
    icon: 'i-heroicons-home',
  },
  {
    label: t('navigation.projects'),
    to: '/projects',
    icon: 'i-heroicons-briefcase',
  },
  {
    label: t('navigation.channels'),
    to: '/channels',
    icon: 'i-heroicons-hashtag',
  },
  {
    label: t('navigation.publications'),
    to: '/publications',
    icon: 'i-heroicons-document-text',
  },
])
</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 lg:hidden pb-safe">
    <div class="flex items-center justify-around h-16">
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center justify-center w-full h-full gap-1 text-[10px] font-medium transition-colors text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        active-class="!text-primary-600 dark:!text-primary-400 bg-gray-50 dark:bg-gray-800/50"
      >
        <UIcon :name="item.icon" class="w-6 h-6" />
        <span class="truncate max-w-[calc(100%-8px)]">{{ item.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
