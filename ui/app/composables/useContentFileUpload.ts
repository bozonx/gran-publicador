import { ref } from 'vue'

export function useContentFileUpload(onUpload: (files: File[]) => void | Promise<void>) {
  const isDropZoneActive = ref(false)
  const dragDepth = ref(0)

  function isFileDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types?.includes('Files') ?? false
  }

  function onDragEnter(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.value += 1
    isDropZoneActive.value = true
  }

  function onDragOver(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    isDropZoneActive.value = true
  }

  function onDragLeave(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.value = Math.max(0, dragDepth.value - 1)
    if (dragDepth.value === 0) {
      isDropZoneActive.value = false
    }
  }

  function onDrop(event: DragEvent) {
    if (!isFileDrag(event)) return
    event.preventDefault()
    dragDepth.value = 0
    isDropZoneActive.value = false
    if (event.dataTransfer?.files) {
      onUpload(Array.from(event.dataTransfer.files))
    }
  }

  return {
    isDropZoneActive,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    isFileDrag
  }
}
