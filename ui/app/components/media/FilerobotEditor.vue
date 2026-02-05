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

onMounted(async () => {
  if (process.server) return
  
  try {
    const module = await import('filerobot-image-editor')
    // The library might export differently depending on version/bundler
    FilerobotImageEditor = module.default || (module as any).FilerobotImageEditor
    
    if (!editorContainer.value) return

    const config = {
      source: props.source,
      onSave: (editedImageObject: any) => {
        const canvas: HTMLCanvasElement | undefined = editedImageObject.imageCanvas
        const type = editedImageObject.mimeType
        const name = editedImageObject.fullName || props.filename || 'edited-image.png'

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
            const file = new File([blob], name, { type })
            emit('save', file)
          },
          type,
        )
      },
      onClose: () => {
        emit('close')
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
    editorInstance.render()
  } catch (err) {
    console.error('Failed to load FilerobotImageEditor:', err)
  }
})

onBeforeUnmount(() => {
  if (editorInstance) {
    if (typeof editorInstance.terminate === 'function') {
      editorInstance.terminate()
    } else if (typeof editorInstance.unmount === 'function') {
      editorInstance.unmount()
    }
  }
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
