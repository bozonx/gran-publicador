<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import yaml from 'js-yaml'

interface ContentBlock {
  id?: string
  text?: string | null
  order: number
  meta?: any
  media?: any[]
}

const props = defineProps<{
  modelValue: ContentBlock
  index: number
  contentItemId?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: ContentBlock): void
  (e: 'remove'): void
  (e: 'refresh'): void
}>()

const { t } = useI18n()
const api = useApi()
const { uploadMedia } = useMedia()

const isCollapsed = ref(false)
const yamlMeta = ref('')
const yamlError = ref<string | null>(null)

// Actions for MediaGallery
async function onAddMedia(media: any[]) {
  if (!props.contentItemId || !props.modelValue.id) return
  
  // The backend expects a single attachment per request with body { mediaId: string }
  // We need to iterate over the array of media items
  try {
    const promises = media.map(item => {
      if (!item.id) return Promise.resolve()
      return api.post(`/content-library/items/${props.contentItemId}/blocks/${props.modelValue.id}/media`, {
        mediaId: item.id
      })
    })

    await Promise.all(promises)
    emit('refresh')
  } catch (e) {
    console.error('Failed to attach media', e)
    // Maybe show toast? usage of useToast is missing in this component but api global handler might catch it or we should add it.
    // For now logging is enough as the global error handler might show something.
  }
}

async function onRemoveMedia(mediaLinkId: string) {
  if (!props.contentItemId || !props.modelValue.id) return
  await api.delete(`/content-library/items/${props.contentItemId}/blocks/${props.modelValue.id}/media/${mediaLinkId}`)
  emit('refresh')
}

async function onReorderMedia(reorderData: any[]) {
  if (!props.contentItemId || !props.modelValue.id) return
  await api.patch(`/content-library/items/${props.contentItemId}/blocks/${props.modelValue.id}/media/reorder`, {
    media: reorderData
  })
  emit('refresh')
}

async function onUpdateLinkMedia(mediaLinkId: string, data: any) {
  // Note: Backend might not have a direct endpoint for updating link metadata like hasSpoiler for blocks yet.
  // If needed, it should be implemented in content-library.service.ts
  // For now, we'll skip or use reorder/bulk update if available.
  console.log('Update link media not implemented for blocks yet', mediaLinkId, data)
}

function handleRefresh() {
  emit('refresh')
}

// Initialize YAML from meta
watch(() => props.modelValue.meta, (newMeta) => {
  try {
    if (newMeta && Object.keys(newMeta).length > 0) {
      const currentYaml = yaml.dump(newMeta)
      if (currentYaml.trim() !== yamlMeta.value.trim()) {
        yamlMeta.value = currentYaml
      }
    } else {
      yamlMeta.value = ''
    }
  } catch (e) {
    console.error('Failed to dump YAML', e)
  }
}, { immediate: true, deep: true })

// Update meta from YAML
watch(yamlMeta, (newYaml) => {
  if (!newYaml.trim()) {
    yamlError.value = null
    if (props.modelValue.meta && Object.keys(props.modelValue.meta).length > 0) {
      emit('update:modelValue', { ...props.modelValue, meta: {} })
    }
    return
  }

  try {
    const parsed = yaml.load(newYaml)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      yamlError.value = t('validation.invalidYaml')
      return
    }
    yamlError.value = null
    emit('update:modelValue', { ...props.modelValue, meta: parsed })
  } catch (e: any) {
    yamlError.value = e.message
  }
})

const updateText = (text: string) => {
  emit('update:modelValue', { ...props.modelValue, text })
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm transition-all">
    <!-- Header/Handle -->
    <div 
      class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 cursor-move border-b border-gray-200 dark:border-gray-800"
      @click="toggleCollapse"
    >
      <div class="flex items-center gap-3 min-w-0">
        <UIcon name="i-heroicons-bars-3" class="w-5 h-5 text-gray-400 drag-handle cursor-grab active:cursor-grabbing" @click.stop />
        <span class="font-medium text-sm text-gray-700 dark:text-gray-300 truncate">
          {{ t('contentLibrary.block', { index: index + 1 }) }}
          <span v-if="props.modelValue.text" class="ml-2 font-normal text-gray-400 dark:text-gray-500 italic">
            - {{ props.modelValue.text.slice(0, 40) }}{{ props.modelValue.text.length > 40 ? '...' : '' }}
          </span>
        </span>
      </div>
      
      <div class="flex items-center gap-1">
        <UButton
          size="xs"
          color="error"
          variant="ghost"
          icon="i-heroicons-trash"
          @click.stop="emit('remove')"
        />
        <UIcon 
          :name="isCollapsed ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'" 
          class="w-5 h-5 text-gray-400"
        />
      </div>
    </div>

    <!-- Body -->
    <div v-show="!isCollapsed" class="p-4 space-y-4">
      <UFormField 
        :label="t('contentLibrary.fields.text')" 
        required
      >
        <UTextarea 
          :model-value="props.modelValue.text ?? ''"
          @update:model-value="updateText"
          :rows="6"
          :placeholder="t('contentLibrary.fields.textPlaceholder')"
          class="w-full font-mono text-sm"
        />
      </UFormField>

      <!-- Media Gallery Integration -->
      <div v-if="props.modelValue.id && props.contentItemId" class="pt-2">
        <MediaGallery
          :media="props.modelValue.media || []"
          :editable="true"
          @refresh="handleRefresh"
          :on-add="onAddMedia"
          :on-remove="onRemoveMedia"
          :on-reorder="onReorderMedia"
          :on-update-link="onUpdateLinkMedia"
        />
      </div>

      <div v-if="yamlMeta" class="space-y-1">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ t('common.meta') }}</span>
        <div class="p-2 rounded bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto text-gray-600 dark:text-gray-400">
          {{ yamlMeta }}
        </div>
      </div>
    </div>
  </div>
</template>


<style scoped>
.drag-handle {
  touch-action: none;
}
</style>
