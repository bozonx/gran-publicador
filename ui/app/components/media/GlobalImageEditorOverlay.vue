<script setup lang="ts">
import { watch } from 'vue'

const { state, isOpen, closeEditor, handleSave } = useGlobalImageEditor()

const handleClose = async () => {
  await closeEditor()
}

const handleEditorSave = async (file: File) => {
  await handleSave(file)
  await closeEditor()
}

watch(
  () => isOpen.value,
  (value) => {
    if (!import.meta.client) return
    if (value) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <UiFullscreenModal v-model:open="isOpen">
    <div v-if="state.source" class="h-full w-full">
      <MediaFilerobotEditor
        :source="state.source"
        :filename="state.filename"
        @save="handleEditorSave"
        @close="handleClose"
      />
    </div>
  </UiFullscreenModal>
</template>
