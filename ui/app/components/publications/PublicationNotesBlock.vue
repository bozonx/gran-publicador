<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'
import { AUTO_SAVE_DEBOUNCE_MS } from '~/constants/autosave'

const props = defineProps<{
    publication: PublicationWithRelations
}>()

const emit = defineEmits(['update'])

const { t } = useI18n()
const { updatePublication } = usePublications()
const toast = useToast()

const isEditing = ref(false)
const localNote = ref(props.publication.note || '')

// Focus textarea when editing starts
const textareaRef = ref<any>(null)

watch(() => props.publication.note, (newNote) => {
    if (!isEditing.value) {
        localNote.value = newNote || ''
        if (props.publication && props.publication.id) {
            nextTick(() => {
                syncBaseline()
            })
        }
    }
})

function startEditing() {
    isEditing.value = true
}

// Auto-save setup
const { saveStatus, saveError, forceSave, isIndicatorVisible, indicatorStatus, syncBaseline, retrySave } = useAutosave({
  data: localNote,
  saveFn: async (note) => {
    // Paranoid payload construction to ensure no reactive proxies or extra fields are sent
    const payload = { note: String(note) }
    await updatePublication(props.publication.id, payload, { silent: true }) // Silent update to not trigger global loading indicators if possible
    
    // We don't emit update here to avoid re-rendering parent components while typing
    // But we might want to update local state if needed

    return { saved: true }
  },
  debounceMs: AUTO_SAVE_DEBOUNCE_MS,
  skipInitial: true,
})

const editContainerRef = ref<HTMLElement | null>(null)

function handleBlur(event: FocusEvent) {
    // If focus moves to another element inside the edit container (e.g. Retry button),
    // do not finish editing — let the user interact with the controls
    const related = event.relatedTarget as HTMLElement | null
    if (related && editContainerRef.value?.contains(related)) {
        return
    }
    finishEditing()
}

async function finishEditing() {
    // Ensure everything is saved
    if (saveStatus.value === 'saving' || saveStatus.value === 'error' || localNote.value !== props.publication.note) {
         try {
            await forceSave()
         } catch (e) {
            // Error is handled by autosave
            return 
         }
    }
    
    isEditing.value = false
    emit('update')
}
</script>

<template>
  <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm transition-all duration-300">
      <!-- Mode: View -->
      <div 
        v-if="!isEditing" 
        class="p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/80 transition-colors group relative" 
        @click="startEditing"
      >
          <div class="flex items-start justify-between gap-4">
              <div class="flex-1 space-y-2">
                  <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors" />
                      <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">{{ t('post.note') }}</span>
                  </div>
                  
                  <div v-if="publication.note" class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {{ publication.note }}
                  </div>
                  <div v-else class="text-gray-400 italic font-light">
                      {{ t('post.notePlaceholder') }}
                  </div>
              </div>

              <div class="shrink-0 pt-1">
                  <UButton
                    icon="i-heroicons-pencil-square"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    class="opacity-0 group-hover:opacity-100 transition-opacity"
                    @click.stop="startEditing"
                  />
              </div>
          </div>
      </div>

      <!-- Mode: Edit -->
      <div v-else ref="editContainerRef" class="p-6 bg-gray-50/50 dark:bg-gray-900/20 space-y-4">
          <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-primary-500" />
                  <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">{{ t('post.note') }}</span>
              </div>
              
              <!-- Autosave Status -->
              <UiSaveStatusIndicator 
                :status="indicatorStatus" 
                :visible="isIndicatorVisible"
                :error="saveError" 
                show-retry
                @retry="retrySave"
              />
          </div>

          <UTextarea
              ref="textareaRef"
              v-model="localNote"
              autoresize
              :rows="3"
              class="w-full"
              :placeholder="t('post.notePlaceholder')"
              variant="outline"
              size="lg"
              autofocus
              @blur="handleBlur"
          />
      </div>
  </div>
</template>

