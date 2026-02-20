<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useContentCollections, type ContentCollection } from '~/composables/useContentCollections'
import { useMedia } from '~/composables/useMedia'
import { useApi } from '~/composables/useApi'

interface Props {
  open: boolean
  filename?: string
  projectId?: string
  /** Blob factory — called when user confirms; must return the exported MP4 blob */
  exportFn: () => Promise<Blob>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  exported: []
}>()

const { t } = useI18n()
const api = useApi()
const { uploadMedia } = useMedia()
const { listCollections } = useContentCollections()
const toast = useToast()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

// Form state
const outputFilename = ref('')
const scope = ref<'personal' | 'project'>('personal')
const selectedCollectionId = ref<string | null>(null)
const selectedGroupId = ref<string | null>(null)

// Collections data
const collections = ref<ContentCollection[]>([])
const isLoadingCollections = ref(false)

// Export state
const isExporting = ref(false)
const exportProgress = ref(0)
const exportError = ref<string | null>(null)
const exportPhase = ref<'encoding' | 'uploading' | 'saving' | null>(null)

const scopeOptions = computed(() => {
  const opts = [{ value: 'personal', label: t('videoEditor.export.scopePersonal') }]
  if (props.projectId) {
    opts.push({ value: 'project', label: t('videoEditor.export.scopeProject') })
  }
  return opts
})

const groupCollections = computed(() =>
  collections.value.filter((c) => c.type === 'GROUP'),
)

const collectionOptions = computed(() =>
  groupCollections.value.map((c) => ({ value: c.id, label: c.title })),
)

// Sub-groups of the selected collection
const subGroupOptions = computed(() => {
  if (!selectedCollectionId.value) return []
  return groupCollections.value
    .filter((c) => c.parentId === selectedCollectionId.value)
    .map((c) => ({ value: c.id, label: c.title }))
})

const phaseLabel = computed(() => {
  if (exportPhase.value === 'encoding') return t('videoEditor.export.phaseEncoding')
  if (exportPhase.value === 'uploading') return t('videoEditor.export.phaseUploading')
  if (exportPhase.value === 'saving') return t('videoEditor.export.phaseSaving')
  return ''
})

async function loadCollections() {
  if (isLoadingCollections.value) return
  isLoadingCollections.value = true
  try {
    const result = await listCollections(
      scope.value,
      scope.value === 'project' ? props.projectId : undefined,
    )
    collections.value = result ?? []
    // Reset selection when collections reload
    selectedCollectionId.value = null
    selectedGroupId.value = null
    // Pre-select first top-level group
    const firstGroup = collections.value.find((c) => c.type === 'GROUP' && !c.parentId)
    if (firstGroup) selectedCollectionId.value = firstGroup.id
  } catch {
    collections.value = []
  } finally {
    isLoadingCollections.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (!val) return
    // Reset state on open
    const base = (props.filename || 'video').replace(/\.[^.]+$/, '')
    outputFilename.value = `${base}_trimmed.mp4`
    scope.value = props.projectId ? 'project' : 'personal'
    exportProgress.value = 0
    exportError.value = null
    exportPhase.value = null
    isExporting.value = false
    loadCollections()
  },
)

watch(scope, () => {
  loadCollections()
})

watch(selectedCollectionId, () => {
  selectedGroupId.value = null
})

async function handleConfirm() {
  if (isExporting.value) return
  isExporting.value = true
  exportProgress.value = 0
  exportError.value = null

  try {
    // Phase 1: encode
    exportPhase.value = 'encoding'
    const blob = await props.exportFn()
    exportProgress.value = 60

    // Phase 2: upload media file
    exportPhase.value = 'uploading'
    const file = new File([blob], outputFilename.value, { type: 'video/mp4' })
    const uploadedMedia = await uploadMedia(
      file,
      (pct) => {
        exportProgress.value = 60 + Math.round(pct * 0.3)
      },
      undefined,
      scope.value === 'project' ? props.projectId : undefined,
    )
    exportProgress.value = 90

    // Phase 3: create content library item
    exportPhase.value = 'saving'
    const groupId = selectedGroupId.value ?? selectedCollectionId.value ?? undefined
    await api.post('/content-library/items', {
      scope: scope.value,
      projectId: scope.value === 'project' ? props.projectId : undefined,
      groupId,
      title: outputFilename.value,
      text: '',
      meta: {},
      media: [{ mediaId: uploadedMedia.id, order: 0, hasSpoiler: false }],
    })

    exportProgress.value = 100
    toast.add({
      title: t('common.success'),
      description: t('videoEditor.export.successMessage'),
      color: 'success',
    })
    emit('exported')
    isOpen.value = false
  } catch (err: any) {
    exportError.value = err?.message || t('videoEditor.export.errorMessage')
  } finally {
    isExporting.value = false
    exportPhase.value = null
  }
}

function handleCancel() {
  if (isExporting.value) return
  isOpen.value = false
}
</script>

<template>
  <AppModal
    v-model:open="isOpen"
    :title="t('videoEditor.export.title')"
    :prevent-close="isExporting"
    :close-button="!isExporting"
  >
    <div class="flex flex-col gap-5">
      <!-- Filename -->
      <UFormField :label="t('videoEditor.export.filename')">
        <UInput
          v-model="outputFilename"
          class="w-full"
          :disabled="isExporting"
        />
      </UFormField>

      <!-- Scope selector (only when project is available) -->
      <UFormField :label="t('videoEditor.export.destination')">
        <AppButtonGroup
          v-model="scope"
          :options="scopeOptions"
          :disabled="isExporting"
        />
      </UFormField>

      <!-- Collection selector -->
      <UFormField :label="t('videoEditor.export.collection')">
        <USelect
          v-model="selectedCollectionId"
          :options="collectionOptions"
          :placeholder="t('videoEditor.export.noCollection')"
          :loading="isLoadingCollections"
          :disabled="isExporting || isLoadingCollections"
          class="w-full"
        />
      </UFormField>

      <!-- Sub-group selector (only when collection has sub-groups) -->
      <UFormField
        v-if="subGroupOptions.length > 0"
        :label="t('videoEditor.export.group')"
      >
        <USelect
          v-model="selectedGroupId"
          :options="subGroupOptions"
          :placeholder="t('videoEditor.export.noGroup')"
          :disabled="isExporting"
          class="w-full"
        />
      </UFormField>

      <!-- Progress -->
      <div v-if="isExporting" class="flex flex-col gap-2">
        <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <span>{{ phaseLabel }}</span>
          <span>{{ exportProgress }}%</span>
        </div>
        <div class="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-primary-500 rounded-full transition-all duration-300"
            :style="{ width: `${exportProgress}%` }"
          />
        </div>
      </div>

      <!-- Error -->
      <UAlert
        v-if="exportError"
        color="error"
        variant="soft"
        icon="i-heroicons-exclamation-triangle"
        :title="t('common.error')"
        :description="exportError"
      />
    </div>

    <template #footer>
      <UButton
        variant="ghost"
        color="neutral"
        :disabled="isExporting"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </UButton>
      <UButton
        color="primary"
        :loading="isExporting"
        :disabled="isExporting"
        icon="i-heroicons-arrow-down-tray"
        @click="handleConfirm"
      >
        {{ t('videoEditor.export.confirm') }}
      </UButton>
    </template>
  </AppModal>
</template>
