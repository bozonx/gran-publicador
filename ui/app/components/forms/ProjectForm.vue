<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ProjectWithRole } from '~/stores/projects'
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

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
const { formatDateWithTime } = useFormatters()
const router = useRouter()
const toast = useToast()

const isEditMode = computed(() => !!props.project?.id)

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
    staleChannelsDays: z.coerce.number()
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
      updateData.description = event.data.description || null // Handle optional description
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
  <div :class="[flat ? '' : FORM_STYLES.wrapper]">
    <div v-if="!hideHeader" :class="FORM_SPACING.headerMargin">
      <h2 :class="FORM_STYLES.title">
        {{ isEditMode ? t('project.editProject') : t('project.createProject') }}
      </h2>
      <p :class="FORM_STYLES.subtitle">
        {{
          isEditMode
            ? t('project.editDescription', 'Update your project information below')
            : t('project.createDescription', 'Fill in the details to create a new project')
        }}
      </p>
    </div>

    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit">
      <div v-if="visibleSections.includes('general')" :class="FORM_SPACING.fields">
        <!-- Created date (read-only, edit mode only) -->
        <CommonFormReadOnlyField
          v-if="isEditMode && project?.createdAt"
          :label="t('project.createdAt', 'Created At')"
          :value="project.createdAt"
          :help="t('project.createdAtHelp', 'The date when this project was created')"
          format-as-date
        />

        <!-- Project name -->
        <UFormField
          name="name"
          :label="t('project.name')"
          required
        >
          <UInput
            v-model="state.name"
            :placeholder="t('project.namePlaceholder', 'Enter project name')"
            :class="FORM_STYLES.fieldFullWidth"
            :size="FORM_STYLES.inputSizeLarge"
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
            :class="FORM_STYLES.fieldFullWidth"
            :rows="FORM_STYLES.textareaRows"
            autoresize
          />
        </UFormField>
      </div>

      <!-- Preferences -->
      <div v-if="visibleSections.includes('preferences')" :class="FORM_SPACING.fields">
        <div v-if="!hideHeader && visibleSections.includes('general')" :class="FORM_SPACING.sectionDivider">
          <h3 :class="FORM_STYLES.sectionTitle">
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
            :class="FORM_STYLES.fieldFullWidth"
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
