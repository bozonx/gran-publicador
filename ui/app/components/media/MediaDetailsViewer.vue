<script setup lang="ts">
import { formatBytes } from '~/utils/media'

const props = defineProps<{
  media: any
  resolution?: string | null
  exifData?: any
  compressionStats?: any
  publicMediaUrl?: string | null
}>()

const emit = defineEmits<{
  (e: 'copy-link'): void
  (e: 'download'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div class="w-full">
    <!-- Read-only fields -->
    <div class="space-y-1 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-mono overflow-x-auto">
      <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">type:</span>
        <span class="text-gray-900 dark:text-gray-200">
          {{ media.storageType }}, {{ media.type }}{{ media.mimeType ? `, ${media.mimeType}` : '' }}
        </span>
      </div>
      <div v-if="media.sizeBytes" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">size:</span>
        <span class="text-gray-900 dark:text-gray-200">{{ formatBytes(media.sizeBytes) }}</span>
      </div>
      <div v-if="resolution" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">resolution:</span>
        <span class="text-gray-900 dark:text-gray-200">{{ resolution }}</span>
      </div>
      <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">path:</span>
        <span class="text-gray-900 dark:text-gray-200 whitespace-nowrap">{{ media.storagePath }}</span>
      </div>
      <div v-if="media.filename" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">filename:</span>
        <span class="text-gray-900 dark:text-gray-200 whitespace-nowrap">{{ media.filename }}</span>
      </div>
      <div class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">id:</span>
        <div class="flex items-center gap-2">
          <span 
            class="text-gray-900 dark:text-gray-200 truncate cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            @click="emit('download')"
          >
            {{ media.id }}
          </span>
          <UIcon 
            name="i-heroicons-arrow-down-tray" 
            class="w-4 h-4 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors shrink-0"
            @click="emit('download')"
          />
        </div>
      </div>
      <div v-if="publicMediaUrl" class="grid grid-cols-[100px_1fr] gap-2 min-w-0">
        <span class="text-gray-500 shrink-0">public url:</span>
        <div class="flex items-center gap-2 min-w-0">
           <span class="text-gray-900 dark:text-gray-200 truncate font-mono text-xs select-all">{{ publicMediaUrl }}</span>
           <UButton 
             icon="i-heroicons-clipboard-document"
             variant="ghost"
             color="neutral"
             size="xs"
             class="-my-1"
             @click="emit('copy-link')"
           />
           <UButton 
             icon="i-heroicons-arrow-top-right-on-square"
             variant="ghost"
             color="neutral"
             size="xs"
             class="-my-1"
             :to="publicMediaUrl"
             target="_blank"
           />
        </div>
      </div>
    </div>

    <!-- Compression statistics -->
    <div v-if="compressionStats" class="mb-6 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-200 dark:border-primary-800/50">
      <div class="flex items-center gap-2 mb-3 text-primary-700 dark:text-primary-300">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
        <span class="font-semibold text-sm">{{ t('media.compressionRatio', 'Compression') }}</span>
        <span v-if="compressionStats.originalFormat && compressionStats.optimizedFormat && compressionStats.originalFormat !== compressionStats.optimizedFormat" class="ml-auto text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
          {{ compressionStats.originalFormat.split('/')[1]?.toUpperCase() }} <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 inline -mt-0.5 mx-0.5" /> {{ compressionStats.optimizedFormat.split('/')[1]?.toUpperCase() }}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">{{ t('media.originalSize') }}</div>
          <div class="text-sm font-mono">{{ compressionStats.originalSize }}</div>
        </div>
        <div class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">{{ t('media.optimizedSize') }}</div>
          <div class="text-sm font-mono text-primary-600 dark:text-primary-400">{{ compressionStats.optimizedSize }}</div>
        </div>
        <div class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">{{ t('media.savedSpace') }}</div>
          <div class="text-sm font-mono text-green-600 dark:text-green-400 font-bold">
            {{ compressionStats.savedPercent }}%
          </div>
        </div>
        <div class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">Ratio</div>
          <div class="text-sm font-mono">{{ compressionStats.ratio }}x</div>
        </div>
        <div v-if="compressionStats.quality" class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">{{ t('media.quality') }}</div>
          <div class="text-sm font-mono">{{ compressionStats.quality }}%</div>
        </div>
        <div v-if="compressionStats.lossless !== undefined" class="space-y-1">
          <div class="text-xxs text-gray-500 uppercase font-bold tracking-tight">{{ t('media.lossless') }}</div>
          <div class="text-sm font-mono flex items-center gap-1">
            <UIcon :name="compressionStats.lossless ? 'i-heroicons-check' : 'i-heroicons-x-mark'" :class="compressionStats.lossless ? 'text-green-500' : 'text-gray-400'" class="w-4 h-4" />
            <span>{{ compressionStats.lossless ? t('common.yes') : t('common.no') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- EXIF Data Display -->
    <div v-if="exifData" class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
      <div class="flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-300">
        <UIcon name="i-heroicons-camera" class="w-5 h-5" />
        <span class="font-semibold text-sm">{{ t('media.exif', 'EXIF Data') }}</span>
      </div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div v-for="(value, key) in exifData" :key="key" class="flex flex-col">
          <span class="text-gray-500 font-medium">{{ key }}</span>
          <span class="text-gray-900 dark:text-gray-200 truncate" :title="String(value)">{{ value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
