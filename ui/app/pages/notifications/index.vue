<script setup lang="ts">
import { DEFAULT_PAGE_SIZE } from '~/constants'
import { useNotificationsStore } from '~/stores/notifications'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const notificationsStore = useNotificationsStore()

const limit = ref(DEFAULT_PAGE_SIZE)
const offset = ref(0)

const hasMoreData = computed(() => {
  return notificationsStore.items.length < notificationsStore.totalCount
})

async function loadNotifications(append = false) {
  if (!append) offset.value = 0
  await notificationsStore.fetchNotifications(limit.value, offset.value, append)
}

async function loadMore() {
  if (notificationsStore.isLoading || !hasMoreData.value) return
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
    <UCard :ui="{ body: 'p-0' }" class="overflow-hidden">
      <template v-if="notificationsStore.unreadCount > 0" #header>
        <div class="flex justify-end">
          <UButton
            variant="soft"
            color="primary"
            icon="i-heroicons-check-badge"
            size="sm"
            @click="markAllAsRead"
          >
            {{ t('notifications.markAllRead') }}
          </UButton>
        </div>
      </template>

      <div v-if="notificationsStore.items.length > 0 || notificationsStore.isLoading">
        <CommonInfiniteList
          :is-loading="notificationsStore.isLoading"
          :has-more="hasMoreData"
          :item-count="notificationsStore.items.length"
          @load-more="loadMore"
        >
          <CommonNotificationsNotificationItem
            v-for="item in notificationsStore.items"
            :key="item.id"
            :notification="item"
            class="first:rounded-t-lg last:rounded-b-lg last:border-b-0"
          />
        </CommonInfiniteList>
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
    </UCard>
  </div>
</template>
