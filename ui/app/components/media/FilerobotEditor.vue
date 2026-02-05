<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

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
  
  try {
    const module = await import('filerobot-image-editor')
    // The library might export differently depending on version/bundler
    FilerobotImageEditor = module.default || (module as any).FilerobotImageEditor
    
    if (!editorContainer.value) return

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

    const config = {
      source: props.source,
      onSave: (editedImageObject: any) => {
        const canvas: HTMLCanvasElement | undefined = editedImageObject.imageCanvas
        const type = normalizeImageMimeType(editedImageObject.mimeType)
        const rawName = editedImageObject.fullName || props.filename || 'edited-image'
        const name = normalizeFilename(rawName, type)

        if (!canvas) {
          console.error('Filerobot onSave: missing imageCanvas')
          emit('close')
          return
        }

        canvas.toBlob(
          (blob: Blob | null) => {
            if (!blob) {
              console.error('Filerobot onSave: canvas.toBlob returned null')
              emit('close')
              return
            }

            if (!type.startsWith('image/')) {
              console.error(`Filerobot onSave: invalid output mimeType: ${type}`)
              emit('close')
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
      onClose: () => {
        terminateEditorInstance()
        emit('close')
      },
    })
  } catch (err) {
    console.error('Failed to load FilerobotImageEditor:', err)
    emit('close')
  }
})

onBeforeUnmount(() => {
  terminateEditorInstance()
})
</script>

<template>
  <div class="filerobot-editor-wrapper w-full h-full flex flex-col bg-gray-950 overflow-hidden">
    <div ref="editorContainer" class="flex-1 min-h-0"></div>
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
