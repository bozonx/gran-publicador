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

onMounted(async () => {
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
      // You can add more config here to match the app style
      theme: {
        palette: {
          'bg-primary': '#111827',
          'bg-secondary': '#1f2937',
          'bg-primary-active': '#374151',
          'accent-primary': '#3b82f6',
          'accent-primary-hover': '#2563eb',
          'accent-primary-active': '#1e40af',
          'borders-secondary': '#374151',
          'txt-primary': '#f3f4f6',
          'txt-secondary': '#9ca3af',
        }
      },
    }

    editorInstance = new FilerobotImageEditor(editorContainer.value, config)
    editorInstance.render({
      onClose: (closingReason: unknown) => {
        console.error('FilerobotImageEditor onClose:', closingReason)

        const reason = typeof closingReason === 'string' ? closingReason : ''
        const shouldClose = reason === 'close-button-clicked'

        if (!shouldClose) {
          loadError.value = 'Image editor closed unexpectedly. Check console for details.'
          terminateEditorInstance()
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
})

onBeforeUnmount(() => {
  terminateEditorInstance()
})
</script>

<template>
  <div class="filerobot-editor-wrapper w-full h-full flex flex-col bg-gray-950 overflow-visible">
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
