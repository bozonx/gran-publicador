<script setup lang="ts">
const { t } = useI18n()

const files = ref<{ name: string; size: number; type: string }[]>([])

function onAddFiles() {
  // TODO: implement file picker / drag-and-drop
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-900 border-r border-gray-700">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
      <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {{ t('granVideoEditor.fileManager.title', 'Files') }}
      </span>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-plus"
        :label="t('granVideoEditor.fileManager.addFiles', 'Add files')"
        @click="onAddFiles"
      />
    </div>

    <!-- File list -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-if="files.length === 0"
        class="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-4 text-center"
      >
        <UIcon name="i-heroicons-folder-open" class="w-10 h-10" />
        <p class="text-sm">
          {{ t('granVideoEditor.fileManager.empty', 'No files added yet. Click "Add files" to get started.') }}
        </p>
      </div>

      <ul v-else class="divide-y divide-gray-800">
        <li
          v-for="file in files"
          :key="file.name"
          class="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer transition-colors"
        >
          <UIcon name="i-heroicons-film" class="w-4 h-4 text-gray-500 shrink-0" />
          <span class="text-sm text-gray-300 truncate flex-1">{{ file.name }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
