<script setup lang="ts">
import { useNotificationsStore } from '~/stores/notifications'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const notificationsStore = useNotificationsStore()

const limit = ref(20)
const offset = ref(0)
const hasMore = ref(true)

async function loadNotifications(append = false) {
  if (!append) offset.value = 0
  
  const response = await notificationsStore.fetchNotifications(limit.value, offset.value, append)
  if (response && response.items) {
    hasMore.value = response.items.length === limit.value
  }
}

async function loadMore() {
  offset.value += limit.value
  await loadNotifications(true)
}

async function markAllAsRead() {
  await notificationsStore.markAllAsRead()
}

onMounted(() => {
  loadNotifications()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-6">
    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ t('notifications.title') }}
        </h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {{ t('notifications.manage_notifs', 'Manage and view your recent activity notifications') }}
        </p>
      </div>
    </div>

    <!-- Notification List -->
    <UiAppCard :padded="false" class="overflow-hidden">
      <template v-if="notificationsStore.unreadCount > 0" #actions>
        <UButton
          variant="soft"
          color="primary"
          icon="i-heroicons-check-badge"
          size="sm"
          @click="markAllAsRead"
        >
          {{ t('notifications.markAllRead') }}
        </UButton>
      </template>

      <div v-if="notificationsStore.items.length > 0">
        <CommonNotificationsNotificationItem
          v-for="item in notificationsStore.items"
          :key="item.id"
          :notification="item"
          class="first:rounded-t-lg last:rounded-b-lg last:border-b-0"
        />
        
        <div v-if="hasMore" class="p-4 text-center border-t dark:border-gray-800">
          <UButton
            variant="ghost"
            color="neutral"
            :loading="notificationsStore.isLoading"
            @click="loadMore"
          >
            {{ t('common.loadMore') }}
          </UButton>
        </div>
      </div>
      
      <div v-else-if="notificationsStore.isLoading" class="p-12 flex flex-col items-center justify-center text-gray-500">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin mb-4" />
        <p class="text-lg font-medium">{{ t('common.loading') }}</p>
      </div>
      
      <div v-else class="p-20 flex flex-col items-center justify-center text-center">
        <div class="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
          <UIcon name="i-heroicons-bell-slash" class="w-10 h-10 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('notifications.empty') }}</h3>
        <p class="text-gray-500 dark:text-gray-400 max-w-sm">
          {{ t('notifications.empty_desc', "You don't have any notifications at the moment. We'll let you know when something important happens.") }}
        </p>
      </div>
    </UiAppCard>
  </div>
</template>
