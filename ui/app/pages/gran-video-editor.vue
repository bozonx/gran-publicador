<script setup lang="ts">
const { t } = useI18n()

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

useHead({
  title: t('navigation.granVideoEditor'),
})
</script>

<template>
  <div class="flex flex-col h-[calc(100vh-4rem)] -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-8 -my-4 sm:-my-6 overflow-hidden">
    <!-- Top half: File Manager + Preview -->
    <div class="grid grid-cols-2 flex-1 min-h-0 border-b border-gray-200 dark:border-gray-700">
      <GranVideoEditorFileManager />
      <GranVideoEditorPreview />
    </div>

    <!-- Bottom half: Timeline -->
    <div class="flex-1 min-h-0">
      <GranVideoEditorTimeline />
    </div>
  </div>
</template>
