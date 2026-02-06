<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'

// Import the editor dynamically to avoid SSR issues
let FilerobotImageEditor: any = null

interface Props {
  source: string
  filename?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'save', file: File): void
  (e: 'close'): void
}>()

const editorContainer = ref<HTMLDivElement | null>(null)
let editorInstance: any = null

const isInstantSaving = ref(false)
const loadError = ref<string | null>(null)

const colorMode = useColorMode()
const isDarkMode = computed(() => colorMode.value === 'dark')

const darkPalette = {
  'bg-primary': '#0f172a',
  'bg-primary-light': '#0f172a',
  'bg-primary-hover': '#111827',
  'bg-primary-active': '#1e293b',
  'bg-primary-stateless': '#1e293b',
  'bg-primary-0-5-opacity': 'rgba(15, 23, 42, 0.5)',
  'bg-secondary': '#111827',
  'bg-stateless': '#111827',
  'bg-hover': '#1e293b',
  'bg-active': '#334155',
  'bg-grey': '#475569',
  'bg-base-light': '#0b1220',
  'bg-base-medium': '#0b1220',
  'bg-tooltip': '#0b1220',
  'txt-primary': '#e5e7eb',
  'txt-secondary': '#94a3b8',
  'txt-secondary-invert': '#111827',
  'txt-placeholder': '#64748b',
  'txt-warning': '#fbbf24',
  'txt-error': '#f87171',
  'txt-info': '#60a5fa',
  'txt-primary-invert': '#0b1220',
  'icon-primary': '#f8fafc',
  'icons-primary-opacity-0-6': 'rgba(248, 250, 252, 0.65)',
  'icons-secondary': '#cbd5e1',
  'icons-placeholder': '#64748b',
  'icons-invert': '#0b1220',
  'icons-muted': '#64748b',
  'icons-primary-hover': '#ffffff',
  'icons-secondary-hover': '#f1f5f9',
  'accent-primary': '#60a5fa',
  'accent-primary-hover': '#2563eb',
  'accent-primary-active': '#1d4ed8',
  'accent-primary-disabled': '#334155',
  'accent-stateless': '#60a5fa',
  'borders-primary': '#475569',
  'borders-primary-hover': '#64748b',
  'borders-secondary': '#334155',
  'borders-strong': '#64748b',
  'borders-invert': '#cbd5e1',
  'border-hover-bottom': 'rgba(59, 130, 246, 0.24)',
  'border-active-bottom': '#3b82f6',
  'border-primary-stateless': '#334155',
  'borders-disabled': 'rgba(59, 130, 246, 0.35)',
  'borders-button': '#475569',
  'borders-item': '#1f2937',
  'link-primary': '#93c5fd',
  'link-stateless': '#93c5fd',
  'link-hover': '#bfdbfe',
  'link-active': '#dbeafe',
  'link-muted': '#94a3b8',
  'link-pressed': '#60a5fa',
  'btn-primary-text': '#ffffff',
  'btn-primary-text-0-6': 'rgba(255, 255, 255, 0.6)',
  'btn-primary-text-0-4': 'rgba(255, 255, 255, 0.4)',
  'btn-disabled-text': '#64748b',
  'btn-secondary-text': '#e5e7eb',
  'error': '#ef4444',
  'error-hover': '#dc2626',
  'error-active': '#b91c1c',
  'success': '#22c55e',
  'warning': '#f59e0b',
  'info': '#3b82f6',
  'light-shadow': 'rgba(0, 0, 0, 0.4)',
  'medium-shadow': 'rgba(0, 0, 0, 0.55)',
  'large-shadow': 'rgba(0, 0, 0, 0.7)',
  'active-secondary': '#111827',
  'active-secondary-hover': 'rgba(96, 165, 250, 0.14)',
} satisfies Record<string, string>

const lightPalette = {
  'bg-primary': '#f8fafc',
  'bg-primary-light': '#f8fafc',
  'bg-primary-hover': '#f1f5f9',
  'bg-primary-active': '#e5e7eb',
  'bg-primary-stateless': '#e5e7eb',
  'bg-primary-0-5-opacity': 'rgba(248, 250, 252, 0.5)',
  'bg-secondary': '#ffffff',
  'bg-stateless': '#ffffff',
  'bg-hover': '#f1f5f9',
  'bg-active': '#e5e7eb',
  'bg-grey': '#cbd5e1',
  'bg-base-light': '#eff6ff',
  'bg-base-medium': '#dbeafe',
  'bg-tooltip': '#0f172a',
  'txt-primary': '#0f172a',
  'txt-secondary': '#334155',
  'txt-secondary-invert': '#e2e8f0',
  'txt-placeholder': '#64748b',
  'txt-warning': '#b45309',
  'txt-error': '#b91c1c',
  'txt-info': '#1d4ed8',
  'txt-primary-invert': '#ffffff',
  'icon-primary': '#0f172a',
  'icons-primary-opacity-0-6': 'rgba(15, 23, 42, 0.6)',
  'icons-secondary': '#334155',
  'icons-placeholder': '#94a3b8',
  'icons-invert': '#ffffff',
  'icons-muted': '#64748b',
  'icons-primary-hover': '#020617',
  'icons-secondary-hover': '#020617',
  'accent-primary': '#2563eb',
  'accent-primary-hover': '#1d4ed8',
  'accent-primary-active': '#1e40af',
  'accent-primary-disabled': '#cbd5e1',
  'accent-stateless': '#2563eb',
  'borders-primary': '#cbd5e1',
  'borders-primary-hover': '#94a3b8',
  'borders-secondary': '#e2e8f0',
  'borders-strong': '#94a3b8',
  'borders-invert': '#0f172a',
  'border-hover-bottom': 'rgba(37, 99, 235, 0.24)',
  'border-active-bottom': '#2563eb',
  'border-primary-stateless': '#cbd5e1',
  'borders-disabled': 'rgba(37, 99, 235, 0.25)',
  'borders-button': '#94a3b8',
  'borders-item': '#e2e8f0',
  'link-primary': '#1d4ed8',
  'link-stateless': '#1d4ed8',
  'link-hover': '#1e40af',
  'link-active': '#1e3a8a',
  'link-muted': '#334155',
  'link-pressed': '#2563eb',
  'btn-primary-text': '#ffffff',
  'btn-primary-text-0-6': 'rgba(255, 255, 255, 0.6)',
  'btn-primary-text-0-4': 'rgba(255, 255, 255, 0.4)',
  'btn-disabled-text': '#64748b',
  'btn-secondary-text': '#0f172a',
  'error': '#dc2626',
  'error-hover': '#b91c1c',
  'error-active': '#991b1b',
  'success': '#16a34a',
  'warning': '#d97706',
  'info': '#2563eb',
  'light-shadow': 'rgba(15, 23, 42, 0.12)',
  'medium-shadow': 'rgba(15, 23, 42, 0.16)',
  'large-shadow': 'rgba(15, 23, 42, 0.22)',
  'active-secondary': '#ffffff',
  'active-secondary-hover': 'rgba(37, 99, 235, 0.08)',
} satisfies Record<string, string>

const editorPalette = computed(() => (isDarkMode.value ? darkPalette : lightPalette))

const baseFilename = computed(() => {
  const raw = props.filename || 'edited-image'
  const trimmed = raw?.trim() ? raw.trim() : 'edited-image'
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0) return trimmed
  return trimmed.slice(0, lastDot)
})

const normalizeImageMimeType = (value: unknown): string => {
  const raw = typeof value === 'string' ? value.toLowerCase() : ''
  if (raw.startsWith('image/')) return raw
  return 'image/png'
}

const getExtensionForMimeType = (mimeType: string): string => {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/avif') return 'avif'
  if (mimeType === 'image/gif') return 'gif'
  return 'png'
}

const normalizeFilename = (name: string, mimeType: string): string => {
  const ext = getExtensionForMimeType(mimeType)
  const safeName = name?.trim() ? name.trim() : `edited-image.${ext}`
  if (safeName.includes('.')) return safeName
  return `${safeName}.${ext}`
}

async function instantSave() {
  if (!editorInstance) return
  if (isInstantSaving.value) return

  isInstantSaving.value = true
  try {
    if (typeof editorInstance.getCurrentImgData !== 'function') {
      console.error('Filerobot instantSave: getCurrentImgData is not available')
      return
    }

    const { imageData, hideLoadingSpinner } = editorInstance.getCurrentImgData(
      {
        name: baseFilename.value,
        extension: 'png',
        quality: 0.95,
      },
      1,
      true,
    )

    const canvas: HTMLCanvasElement | undefined = imageData?.imageCanvas
    const type = normalizeImageMimeType(imageData?.mimeType || 'image/png')
    const rawName = imageData?.fullName || props.filename || 'edited-image'
    const name = normalizeFilename(rawName, type)

    if (!canvas) {
      console.error('Filerobot instantSave: missing imageCanvas')
      return
    }

    await new Promise<void>((resolve) => {
      canvas.toBlob(
        (blob: Blob | null) => {
          try {
            if (!blob) {
              console.error('Filerobot instantSave: canvas.toBlob returned null')
              return
            }

            if (!type.startsWith('image/')) {
              console.error(`Filerobot instantSave: invalid output mimeType: ${type}`)
              return
            }

            const file = new File([blob], name, { type })
            emit('save', file)
          } finally {
            resolve()
          }
        },
        type,
      )
    })
    hideLoadingSpinner?.()
  } catch (error) {
    console.error('Filerobot instantSave: failed', error)
  } finally {
    isInstantSaving.value = false
  }
}

function terminateEditorInstance() {
  if (!editorInstance) return

  try {
    if (typeof editorInstance.terminate === 'function') {
      editorInstance.terminate()
      return
    }
    if (typeof editorInstance.unmount === 'function') {
      editorInstance.unmount()
    }
  } catch (error) {
    console.error('Failed to terminate FilerobotImageEditor instance:', error)
  } finally {
    editorInstance = null
  }
}

async function initEditor() {
  if (!import.meta.client) return
  loadError.value = null

  try {
    const module = await import('filerobot-image-editor')
    // The library might export differently depending on version/bundler
    FilerobotImageEditor = module.default || (module as any).FilerobotImageEditor
    
    if (!editorContainer.value) return

    const config = {
      source: props.source,
      onSave: (editedImageObject: any) => {
        const canvas: HTMLCanvasElement | undefined = editedImageObject.imageCanvas
        const type = normalizeImageMimeType(editedImageObject.mimeType)
        const rawName = editedImageObject.fullName || props.filename || 'edited-image'
        const name = normalizeFilename(rawName, type)

        if (!canvas) {
          console.error('Filerobot onSave: missing imageCanvas')
          return
        }

        canvas.toBlob(
          (blob: Blob | null) => {
            if (!blob) {
              console.error('Filerobot onSave: canvas.toBlob returned null')
              return
            }

            if (!type.startsWith('image/')) {
              console.error(`Filerobot onSave: invalid output mimeType: ${type}`)
              return
            }

            const file = new File([blob], name, { type })
            emit('save', file)
          },
          type,
        )
      },
      // Filerobot 4.x config
      annotationsCommon: {
        fill: '#3b82f6', // primary blue
      },
      Text: { text: 'Type here...' },
      rotate: { angle: 90, factor: 1 },
      closeAfterSave: false,
      defaultSavedImageName: baseFilename.value,
      defaultSavedImageType: 'png',
      defaultSavedImageQuality: 0.95,
      showBackButton: false,
      removeSaveButton: true,
      theme: {
        palette: editorPalette.value,
      },
    }

    editorInstance = new FilerobotImageEditor(editorContainer.value, config)
    editorInstance.render({
      onClose: (closingReason: unknown) => {
        const reason = typeof closingReason === 'string' ? closingReason : ''

        const shouldClose =
          reason === 'close-button-clicked' ||
          reason === 'back-button-clicked' ||
          reason === 'esc-key-pressed' ||
          reason === 'overlay-clicked'

        if (!shouldClose) {
          console.debug('FilerobotImageEditor onClose ignored:', closingReason)
          return
        }

        terminateEditorInstance()
        emit('close')
      },
    })
  } catch (err) {
    console.error('Failed to load FilerobotImageEditor:', err)
    loadError.value = 'Failed to initialize image editor. Check console for details.'
  }
}

onMounted(async () => {
  await initEditor()
})

onBeforeUnmount(() => {
  terminateEditorInstance()
})
</script>

<template>
  <div
    class="filerobot-editor-wrapper w-full h-full flex flex-col overflow-visible"
    :class="isDarkMode ? 'bg-gray-950' : 'bg-gray-50'"
  >
    <div class="absolute top-3 right-14 z-60">
      <button
        type="button"
        class="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="isInstantSaving"
        @click="instantSave"
      >
        Save
      </button>
    </div>
    <div v-if="loadError" class="flex-1 min-h-0 flex items-center justify-center p-6">
      <div class="max-w-xl text-center">
        <div class="text-white font-semibold">Image editor failed to load</div>
        <div class="mt-2 text-sm text-gray-300">{{ loadError }}</div>
      </div>
    </div>
    <div v-else ref="editorContainer" class="flex-1 min-h-0"></div>
  </div>
</template>

<style scoped>
.filerobot-editor-wrapper {
  position: relative;
  z-index: 50;
}

/* Ensure Filerobot takes full space */
:deep(.filerobot-image-editor-root) {
  height: 100% !important;
  width: 100% !important;
}

/* Ensure canvas area fills available height */
:deep(.SfxImageEditor-canvas-container) {
  flex-grow: 1;
}
</style>

<style>
#SfxPopper,
#SfxPopup {
  z-index: 9999 !important;
}
</style>
