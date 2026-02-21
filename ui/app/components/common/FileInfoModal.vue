<script setup lang="ts">
import AppModal from '~/components/ui/AppModal.vue'

const isOpen = defineModel<boolean>('open', { required: true })

export interface FileInfo {
  name: string
  kind: 'file' | 'directory'
  size?: number
  lastModified?: number
}

const props = defineProps<{
  info: FileInfo | null
}>()

const { t } = useI18n()

function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('videoEditor.fileManager.info.title', 'File Information')"
    :ui="{ content: 'sm:max-w-md' }"
  >
    <div v-if="info" class="space-y-4">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-sm text-gray-500">{{ t('common.name', 'Name') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100 break-all">{{ info.name }}</span>
        </div>
        <div class="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-sm text-gray-500">{{ t('common.type', 'Type') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100">
            {{ info.kind === 'directory' ? t('common.folder', 'Folder') : t('common.file', 'File') }}
          </span>
        </div>
        <div v-if="info.size !== undefined" class="flex flex-col gap-1 border-b border-gray-100 dark:border-gray-800 pb-2">
          <span class="text-sm text-gray-500">{{ t('common.size', 'Size') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ formatBytes(info.size) }}</span>
        </div>
        <div v-if="info.lastModified" class="flex flex-col gap-1 pb-2">
          <span class="text-sm text-gray-500">{{ t('common.modified', 'Modified') }}</span>
          <span class="font-medium text-gray-900 dark:text-gray-100">{{ new Date(info.lastModified).toLocaleString() }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <UButton
        color="neutral"
        variant="ghost"
        @click="isOpen = false"
      >
        {{ t('common.close', 'Close') }}
      </UButton>
    </template>
  </AppModal>
</template>
