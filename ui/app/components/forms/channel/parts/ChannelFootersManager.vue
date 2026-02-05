<script setup lang="ts">
import { VueDraggable } from 'vue-draggable-plus'
import type { ChannelFooter, ChannelWithProject } from '~/types/channels'
import { containsBlockMarkdown } from '~/utils/markdown-validation'

interface Props {
  channel: ChannelWithProject
}

const props = defineProps<Props>()
const emit = defineEmits(['update'])

const { t } = useI18n()
const toast = useToast()
const { updateChannel } = useChannels()

// Local copy of footers
const footers = ref<ChannelFooter[]>([])
const deletedFooters = ref<ChannelFooter[]>([])
const showDeleted = ref(false)

// Sync with prop
watch(() => props.channel, (newVal) => {
  if (newVal?.preferences?.footers) {
    const currentJson = JSON.stringify(footers.value)
    const newJson = JSON.stringify(newVal.preferences.footers)
    if (currentJson !== newJson) {
      footers.value = JSON.parse(newJson)
    }
  } else {
    footers.value = []
  }
}, { immediate: true, deep: true })

// Logic
const isFooterModalOpen = ref(false)
const editingFooter = ref<ChannelFooter | null>(null)
const footerForm = reactive({
  id: '',
  name: '',
  content: '',
  isDefault: false
})

const debouncedSave = useDebounceFn(async () => {
  if (!props.channel) return
  
  try {
    const updateData = {
      preferences: {
        ...(props.channel.preferences || {}),
        footers: footers.value,
      }
    }
    
    await updateChannel(props.channel.id, updateData)
    emit('update')
  } catch (error) {
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error'
    })
  }
}, 1000)

async function autoSave() {
  await debouncedSave()
}

function openAddFooter() {
  editingFooter.value = null
  footerForm.id = crypto.randomUUID()
  footerForm.name = ''
  footerForm.content = ''
  footerForm.isDefault = footers.value.length === 0
  isFooterModalOpen.value = true
}

function openEditFooter(footer: ChannelFooter) {
  editingFooter.value = footer
  footerForm.id = footer.id
  footerForm.name = footer.name
  footerForm.content = footer.content
  footerForm.isDefault = footer.isDefault
  isFooterModalOpen.value = true
}

function saveFooter() {
  if (!footerForm.content) return

  if (containsBlockMarkdown(footerForm.content)) {
    toast.add({
      title: t('common.error'),
      description: t('validation.inlineMarkdownOnly'),
      color: 'error'
    })
    return
  }

  // Automatically set name from content for backend compatibility
  footerForm.name = footerForm.content.split('\n')[0].slice(0, 50) || 'Footer'

  if (footerForm.isDefault) {
    footers.value.forEach(f => f.isDefault = false)
  }

  if (editingFooter.value) {
    const index = footers.value.findIndex(f => f.id === footerForm.id)
    if (index !== -1) {
       const updatedFooter: ChannelFooter = {
        id: footerForm.id || '',
        name: footerForm.name || '',
        content: footerForm.content || '',
        isDefault: !!footerForm.isDefault
      }
      footers.value[index] = updatedFooter
    }
  } else {
     const newFooter: ChannelFooter = {
      id: footerForm.id || '',
      name: footerForm.name || '',
      content: footerForm.content || '',
      isDefault: !!footerForm.isDefault
    }
    footers.value.push(newFooter)
  }

  // Ensure at least one is default if list is not empty
  if (footers.value.length > 0 && !footers.value.some(f => f.isDefault)) {
    footers.value[0].isDefault = true
  }

  isFooterModalOpen.value = false
  autoSave()
}

function restoreFooter(footer: ChannelFooter) {
  footers.value.push({ ...footer })
  deletedFooters.value = deletedFooters.value.filter(f => f.id !== footer.id)
  autoSave()
}

function deleteFooter(id: string) {
  const index = footers.value.findIndex(f => f.id === id)
  if (index !== -1) {
    const footer = footers.value[index]
    const removedWasDefault = footer.isDefault
    
    // Add to session-only deleted list
    deletedFooters.value.push({ ...footer })
    
    footers.value.splice(index, 1)
    
    if (removedWasDefault && footers.value.length > 0) {
      footers.value[0].isDefault = true
    }
    autoSave()
  }
}

function setDefaultFooter(id: string) {
  footers.value.forEach(f => {
    f.id === id ? f.isDefault = true : f.isDefault = false
  })
  autoSave()
}

const isMounted = ref(false)
onMounted(() => isMounted.value = true)
const hasTeleportTarget = computed(() => isMounted.value && !!document?.getElementById('channel-footers-actions'))
</script>

<template>
  <div class="space-y-4">
    <Teleport defer to="#channel-footers-actions" v-if="hasTeleportTarget">
      <UButton
        icon="i-heroicons-plus"
        size="xs"
        color="primary"
        variant="soft"
        @click="openAddFooter"
      >
        {{ t('channel.addFooter') }}
      </UButton>
    </Teleport>

    <!-- Header for standalone usage if teleport target not available -->
    <div v-else class="flex items-center justify-between mb-4 header-fallback">
       <h3 class="text-lg font-medium text-gray-900 dark:text-white">
         {{ t('channel.footers') }}
       </h3>

       <UButton
        icon="i-heroicons-plus"
        size="xs"
        color="primary"
        variant="soft"
        @click="openAddFooter"
      >
        {{ t('channel.addFooter') }}
      </UButton>
    </div>

    <div v-if="footers.length === 0" class="text-center py-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
      <UIcon name="i-heroicons-chat-bubble-bottom-center-text" class="w-8 h-8 mx-auto text-gray-400 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('channel.noFooters') }}
      </p>
    </div>

    <VueDraggable
      v-model="footers"
      :animation="150"
      handle=".drag-handle"
      class="space-y-3"
      @end="autoSave"
    >
      <div
        v-for="footer in footers"
        :key="footer.id"
        class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-primary-500 dark:hover:border-primary-400 transition-colors cursor-pointer group"
        @click="openEditFooter(footer)"
      >
        <div class="flex items-center gap-3 overflow-hidden">
          <div 
            class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 -ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            @click.stop
          >
            <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
              {{ footer.content }}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <UIcon 
            v-if="footer.isDefault" 
            name="i-heroicons-star-20-solid" 
            class="w-4 h-4 text-primary-500 mr-2" 
          />
          <div class="w-4 h-4 mr-2" v-else></div>
          
          <UButton
            icon="i-heroicons-trash"
            size="xs"
            variant="ghost"
            color="error"
            @click.stop="deleteFooter(footer.id)"
          />
        </div>
      </div>
    </VueDraggable>

    <!-- Deleted Footers (Session only) -->
    <div v-if="deletedFooters.length > 0" class="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        :icon="showDeleted ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
        @click="showDeleted = !showDeleted"
      >
        {{ t('channel.deletedFooters', { count: deletedFooters.length }) }}
      </UButton>
      
      <div v-if="showDeleted" class="mt-2 space-y-2">
        <div
          v-for="footer in deletedFooters"
          :key="footer.id"
          class="flex items-center justify-between py-1.5 px-3 bg-gray-50/30 dark:bg-gray-800/20 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg opacity-50 hover:opacity-80 transition-opacity"
        >
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5 text-gray-400" />
            <div class="text-xs truncate max-w-[200px]">
              <span class="text-gray-500 dark:text-gray-400 italic line-through mr-2">{{ footer.content }}</span>
            </div>
          </div>
          <UButton
            icon="i-heroicons-arrow-path"
            size="xs"
            variant="ghost"
            color="primary"
            class="scale-90"
            @click="restoreFooter(footer)"
          >
            {{ t('common.restore', 'Restore') }}
          </UButton>
        </div>
      </div>
    </div>
    
    <!-- Footer Modal -->
    <UiAppModal 
      v-model:open="isFooterModalOpen"
      :title="editingFooter ? t('channel.editFooter') : t('channel.addFooter')"
    >
      <div class="space-y-4">

        <UFormField required>
          <template #label>
            <div class="flex items-center gap-1.5">
              <span>{{ t('channel.footerContent') }}</span>
              <CommonInfoTooltip :text="t('common.inlineMarkdownHelp')" />
            </div>
          </template>
          <UTextarea
            v-model="footerForm.content"
            :placeholder="t('channel.footerContentPlaceholder')"
            :rows="4"
            class="w-full"
          />
        </UFormField>

        <UCheckbox
          v-model="footerForm.isDefault"
          :label="t('channel.footerDefault')"
        />
      </div>

      <template #footer>
        <UButton color="neutral" variant="ghost" @click="isFooterModalOpen = false">
          {{ t('common.cancel') }}
        </UButton>
        <UButton color="primary" @click="saveFooter">
          {{ t('common.save') }}
        </UButton>
      </template>
    </UiAppModal>
  </div>
</template>
