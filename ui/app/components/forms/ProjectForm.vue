<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ProjectWithRole } from '~/stores/projects'

interface Props {
  /** Project data for editing, null for creating new */
  project?: ProjectWithRole | null
  /** Whether the form is in loading state */
  isLoading?: boolean
  /** Custom label for submit button */
  submitLabel?: string
  /** Custom label for cancel button */
  cancelLabel?: string
  /** Whether to hide the header section */
  hideHeader?: boolean
  /** Whether to hide the cancel button */
  hideCancel?: boolean
  /** Whether to remove the card styling wrapper */
  flat?: boolean
  /** Sections to show */
  visibleSections?: ('general' | 'preferences')[]
}

interface Emits {
  (e: 'submit', data: Partial<ProjectWithRole>): void | Promise<void>
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  project: null,
  isLoading: false,
  submitLabel: undefined,
  cancelLabel: undefined,
  hideHeader: false,
  hideCancel: false,
  flat: false,
  visibleSections: () => ['general', 'preferences'],
})

const emit = defineEmits<Emits>()

const formActionsRef = ref<{ showSuccess: () => void; showError: () => void } | null>(null)

const { t } = useI18n()
const router = useRouter()

const isEditMode = computed(() => !!props.project?.id)

// Helper function to format date
function formatDate(date: string | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

// Form state interface
interface FormState {
  name: string
  description: string
  preferences: {
    staleChannelsDays?: number
  }
}

// Form state
const state = reactive<FormState>({
  name: props.project?.name || '',
  description: props.project?.description || '',
  preferences: {
    staleChannelsDays: props.project?.preferences?.staleChannelsDays,
  }
})

// Validation Schema
const schema = z.object({
  name: z.string()
    .min(2, t('validation.minLength', { min: 2 }))
    .nonempty(t('validation.required')),
  description: z.string()
    .max(500, t('validation.maxLength', { max: 500 }))
    .optional(),
  preferences: z.object({
    staleChannelsDays: z.number({ coerce: true })
      .min(1, t('validation.min', { min: 1 }))
      .optional()
  }).optional()
})

type Schema = z.output<typeof schema>

// Dirty state tracking
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(state)

// Save original state when component mounts or project changes
watch(() => props.project, () => {
  state.name = props.project?.name || ''
  state.description = props.project?.description || ''
  state.preferences = {
    staleChannelsDays: props.project?.preferences?.staleChannelsDays,
  }
  nextTick(() => {
    saveOriginalState()
  })
}, { immediate: true })

/**
 * Form submission handler
 */
async function handleSubmit(event: FormSubmitEvent<Schema>) {
  try {
    const updateData: Partial<ProjectWithRole> = {}

    if (props.visibleSections.includes('general')) {
      updateData.name = event.data.name
      updateData.description = event.data.description || '' // Handle optional description
    }

    if (props.visibleSections.includes('preferences')) {
      updateData.preferences = {
        staleChannelsDays: event.data.preferences?.staleChannelsDays
      }
    }

    await emit('submit', updateData)
    formActionsRef.value?.showSuccess()
    // Update original state after successful save
    saveOriginalState()
  } catch (error) {
    formActionsRef.value?.showError()
    const toast = useToast()
    toast.add({
      title: t('common.error'),
      description: t('common.saveError', 'Failed to save'),
      color: 'error',
      duration: 5000
    })
  }
}

function handleCancel() {
  emit('cancel')
}

function handleReset() {
  resetToOriginal()
}
</script>

<template>
  <div :class="[flat ? '' : 'bg-white dark:bg-gray-800 rounded-lg shadow p-6']">
    <div v-if="!hideHeader" class="mb-6">
      <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
        {{ isEditMode ? t('project.editProject') : t('project.createProject') }}
      </h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{
          isEditMode
            ? t('project.editDescription', 'Update your project information below')
            : t('project.createDescription', 'Fill in the details to create a new project')
        }}
      </p>
    </div>

    <UForm :schema="schema" :state="state" class="space-y-6" @submit="handleSubmit">
      <div v-if="visibleSections.includes('general')" class="space-y-6">
        <!-- Created date (read-only, edit mode only) -->
        <div v-if="isEditMode && project?.createdAt" class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('project.createdAt', 'Created At') }}
          </label>
          <div class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
            <span class="text-gray-900 dark:text-white">{{ formatDate(project.createdAt) }}</span>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            {{ t('project.createdAtHelp', 'The date when this project was created') }}
          </p>
        </div>

        <!-- Project name -->
        <UFormField
          name="name"
          :label="t('project.name')"
          required
        >
          <UInput
            v-model="state.name"
            :placeholder="t('project.namePlaceholder', 'Enter project name')"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <!-- Project description -->
        <UFormField
          name="description"
          :label="t('project.description')"
          :help="`${t('common.optional')} — ${t('validation.maxLength', { max: 500 })}`"
        >
          <UTextarea
            v-model="state.description"
            :placeholder="t('project.descriptionPlaceholder', 'Enter project description')"
            class="w-full"
            :rows="3"
          />
        </UFormField>
      </div>

      <!-- Preferences -->
      <div v-if="visibleSections.includes('preferences')" class="space-y-4">
        <div v-if="!hideHeader && visibleSections.includes('general')" class="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            {{ t('settings.preferences', 'Preferences') }}
          </h3>
        </div>
        
        <UFormField
          name="preferences.staleChannelsDays"
          :label="t('settings.staleChannelsDays', 'Stale Channels Warning (Days)')"
          :help="t('settings.staleChannelsDaysHelp', 'Show warning if channel has no published posts for this many days (Default: 3)')"
        >
          <UInput
            v-model.number="state.preferences.staleChannelsDays"
            type="number"
            min="1"
            :placeholder="'3'"
            class="w-full"
          />
        </UFormField>
      </div>

      <!-- Form actions -->
      <UiFormActions
        ref="formActionsRef"
        :loading="isLoading"
        :is-dirty="isDirty"
        :save-label="submitLabel || (isEditMode ? t('common.save') : t('common.create'))"
        :cancel-label="cancelLabel"
        :hide-cancel="hideCancel"
        @reset="handleReset"
        @cancel="handleCancel"
      />
    </UForm>
  </div>
</template>
