<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppModal from '~/components/ui/AppModal.vue'

const props = defineProps<{
  open: boolean
  scope?: 'personal' | 'project'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'create': [data: { type: 'GROUP' | 'SAVED_VIEW'; title: string; groupType?: 'PROJECT_USER' | 'PROJECT_SHARED' }]
}>()

const { t } = useI18n()

const selectedType = ref<'GROUP' | 'SAVED_VIEW' | null>(null)
const selectedGroupType = ref<'PROJECT_USER' | 'PROJECT_SHARED' | null>(null)
const title = ref('')

const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})

const canProceed = computed(() => {
  if (!selectedType.value) return false
  if (title.value.trim().length === 0) return false
  if (selectedType.value === 'GROUP' && props.scope === 'project') {
    return selectedGroupType.value !== null
  }
  return true
})

const handleCreate = () => {
  if (!canProceed.value || !selectedType.value) return
  
  emit('create', {
    type: selectedType.value,
    title: title.value.trim(),
    ...(selectedType.value === 'GROUP' && props.scope === 'project' && selectedGroupType.value
      ? { groupType: selectedGroupType.value }
      : {}),
  })
  
  handleClose()
}

const handleClose = () => {
  isOpen.value = false
  selectedType.value = null
  selectedGroupType.value = null
  title.value = ''
}

watch(() => props.open, (val) => {
  if (!val) {
    selectedType.value = null
    selectedGroupType.value = null
    title.value = ''
  }
})
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('contentLibrary.tabs.createTitle')"
    @close="handleClose"
  >
    <div class="space-y-6">
      <div v-if="!selectedType" class="space-y-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">
          {{ t('contentLibrary.tabs.selectTypePrompt') }}
        </p>

        <div class="grid grid-cols-1 gap-3">
          <button
            class="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left group"
            @click="selectedType = 'GROUP'"
          >
            <div class="flex items-start gap-3">
              <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                <UIcon name="i-heroicons-folder" class="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 dark:text-white mb-1">
                  {{ t('contentLibrary.tabs.types.group.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ t('contentLibrary.tabs.types.group.description') }}
                </p>
              </div>
            </div>
          </button>

          <button
            class="p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left group"
            @click="selectedType = 'SAVED_VIEW'"
          >
            <div class="flex items-start gap-3">
              <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                <UIcon name="i-heroicons-bookmark" class="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 dark:text-white mb-1">
                  {{ t('contentLibrary.tabs.types.savedView.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ t('contentLibrary.tabs.types.savedView.description') }}
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>

      <div v-else class="space-y-4">
        <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <UIcon :name="selectedType === 'GROUP' ? 'i-heroicons-folder' : 'i-heroicons-bookmark'" class="w-4 h-4" />
          <span>{{ t(`contentLibrary.tabs.types.${selectedType === 'GROUP' ? 'group' : 'savedView'}.title`) }}</span>
        </div>

        <div
          v-if="selectedType === 'GROUP' && props.scope === 'project'"
          class="space-y-2"
        >
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {{ t('contentLibrary.tabs.groupVisibility.label') }}
          </p>
          <USelect
            v-model="selectedGroupType"
            :options="[
              { label: t('contentLibrary.tabs.groupVisibility.projectUser'), value: 'PROJECT_USER' },
              { label: t('contentLibrary.tabs.groupVisibility.projectShared'), value: 'PROJECT_SHARED' },
            ]"
            :placeholder="t('contentLibrary.tabs.groupVisibility.placeholder')"
          />
        </div>

        <UInput
          v-model="title"
          :placeholder="t('contentLibrary.tabs.titlePlaceholder')"
          autofocus
          @keydown.enter="handleCreate"
        />

        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            @click="selectedType = null"
          >
            {{ t('common.back') }}
          </UButton>
          <UButton
            color="primary"
            :disabled="!canProceed"
            @click="handleCreate"
          >
            {{ t('common.create') }}
          </UButton>
        </div>
      </div>
    </div>
  </AppModal>
</template>
