<script setup lang="ts">
const { t } = useI18n()

interface FsEntry {
  name: string
  kind: 'file' | 'directory'
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  children?: FsEntry[]
  expanded?: boolean
}

const rootEntries = ref<FsEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const isApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

async function readDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FsEntry[]> {
  const entries: FsEntry[] = []
  try {
    const iterator = (dirHandle as any).values?.() ?? (dirHandle as any).entries?.()
    if (!iterator) return entries

    for await (const value of iterator) {
      const handle = Array.isArray(value) ? value[1] : value
      entries.push({
        name: handle.name,
        kind: handle.kind,
        handle,
        children: undefined,
        expanded: false,
      })
    }
  } catch (e: any) {
    throw new Error(e?.message ?? 'Failed to read directory')
  }
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

async function openFolder() {
  if (!isApiSupported) return
  error.value = null
  isLoading.value = true
  try {
    const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' })
    rootEntries.value = await readDirectory(dirHandle)
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      error.value = e?.message ?? 'Failed to open folder'
    }
  } finally {
    isLoading.value = false
  }
}

async function toggleDirectory(entry: FsEntry) {
  if (entry.kind !== 'directory') return
  error.value = null
  entry.expanded = !entry.expanded
  if (entry.expanded && entry.children === undefined) {
    try {
      entry.children = await readDirectory(entry.handle as FileSystemDirectoryHandle)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to read folder'
      entry.expanded = false
    }
  }
}

function getFileIcon(entry: FsEntry): string {
  if (entry.kind === 'directory') return 'i-heroicons-folder'
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? ''
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'i-heroicons-film'
  if (['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) return 'i-heroicons-musical-note'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'i-heroicons-photo'
  return 'i-heroicons-document'
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
        icon="i-heroicons-folder-open"
        :label="t('granVideoEditor.fileManager.openFolder', 'Open folder')"
        :loading="isLoading"
        :disabled="!isApiSupported"
        @click="openFolder"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="isLoading" class="px-3 py-4 text-sm text-gray-400">
        {{ t('common.loading', 'Loading...') }}
      </div>

      <!-- Empty state -->
      <div
        v-else-if="rootEntries.length === 0 && !error"
        class="flex flex-col items-center justify-center h-full gap-3 text-gray-600 px-4 text-center"
      >
        <UIcon name="i-heroicons-folder-open" class="w-10 h-10" />
        <p class="text-sm">
          {{ isApiSupported
            ? t('granVideoEditor.fileManager.empty', 'Open a local folder to browse files')
            : t('granVideoEditor.fileManager.unsupported', 'File System Access API is not supported in this browser') }}
        </p>
        <UButton
          v-if="isApiSupported"
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-heroicons-folder-open"
          :label="t('granVideoEditor.fileManager.openFolder', 'Open folder')"
          @click="openFolder"
        />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="px-3 py-4 text-sm text-red-400">
        {{ error }}
      </div>

      <!-- File tree -->
      <GranVideoEditorFileManagerTree
        v-else
        :entries="rootEntries"
        :depth="0"
        :get-file-icon="getFileIcon"
        @toggle="toggleDirectory"
      />
    </div>
  </div>
</template>
