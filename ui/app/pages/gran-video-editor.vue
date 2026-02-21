<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  layout: 'editor',
  middleware: 'auth',
})

useHead({
  title: t('navigation.granVideoEditor'),
})
</script>

<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden bg-gray-950">
    <!-- Top half: File Manager + Preview -->
    <div class="grid grid-cols-2 flex-1 min-h-0 border-b border-gray-700">
      <GranVideoEditorFileManager />
      <GranVideoEditorPreview />
    </div>

    <!-- Bottom half: Timeline -->
    <div class="flex-1 min-h-0">
      <GranVideoEditorTimeline />
    </div>
  </div>
</template>
