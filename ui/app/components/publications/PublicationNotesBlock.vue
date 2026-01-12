<script setup lang="ts">
import type { PublicationWithRelations } from '~/composables/usePublications'

const props = defineProps<{
    publication: PublicationWithRelations
}>()

const emit = defineEmits(['update'])

const { t } = useI18n()
const { updatePublication } = usePublications()
const toast = useToast()

const isEditing = ref(false)
const localNote = ref(props.publication.note || '')
const isSaving = ref(false)

// Focus textarea when editing starts
const textareaRef = ref<any>(null)

watch(() => props.publication.note, (newNote) => {
    if (!isEditing.value) {
        localNote.value = newNote || ''
    }
})

function startEditing() {
    isEditing.value = true
}

function cancelEditing() {
    isEditing.value = false
    localNote.value = props.publication.note || ''
}

async function saveNote() {
    isSaving.value = true
    try {
        await updatePublication(props.publication.id, {
            note: localNote.value
        })
        isEditing.value = false
        emit('update')
        toast.add({
            title: t('common.success'),
            color: 'success'
        })
    } catch (err: any) {
        toast.add({
            title: t('common.error'),
            description: err.message || t('common.saveError'),
            color: 'error'
        })
    } finally {
        isSaving.value = false
    }
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
      <div v-else class="p-6 bg-gray-50/50 dark:bg-gray-900/20 space-y-4">
          <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-pencil-square" class="w-4 h-4 text-primary-500" />
              <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">{{ t('post.note') }}</span>
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
          />

          <div class="flex justify-end gap-3 pt-2">
              <UButton
                  variant="ghost"
                  color="neutral"
                  :label="t('common.cancel')"
                  @click="cancelEditing"
              />
              <UButton
                  variant="solid"
                  color="primary"
                  :label="t('common.save')"
                  :loading="isSaving"
                  class="px-6"
                  @click="saveNote"
              />
          </div>
      </div>
  </div>
</template>
