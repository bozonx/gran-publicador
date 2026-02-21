<script setup lang="ts">
import { useVideoEditorStore } from '~/stores/videoEditor'

const { t } = useI18n()
const videoEditorStore = useVideoEditorStore()

interface FsEntry {
  name: string
  kind: 'file' | 'directory'
  handle: FileSystemFileHandle | FileSystemDirectoryHandle
  children?: FsEntry[]
  expanded?: boolean
}

const activeTab = ref('files')
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const rootEntries = ref<FsEntry[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)

const isApiSupported = videoEditorStore.isApiSupported

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

async function loadProjectDirectory() {
  if (!videoEditorStore.projectsHandle || !videoEditorStore.currentProjectName) {
    rootEntries.value = []
    return
  }
  
  error.value = null
  isLoading.value = true
  try {
    const projectDir = await videoEditorStore.projectsHandle.getDirectoryHandle(videoEditorStore.currentProjectName)
    rootEntries.value = await readDirectory(projectDir)
    
    // Automatically expand the sources directory if present
    for (const entry of rootEntries.value) {
      if (entry.kind === 'directory' && entry.name === 'sources') {
        await toggleDirectory(entry)
      }
    }
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      error.value = e?.message ?? 'Failed to open project folder'
    }
  } finally {
    isLoading.value = false
  }
}

watch(() => videoEditorStore.currentProjectName, loadProjectDirectory, { immediate: true })

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
  if (ext === 'otio') return 'i-heroicons-document-text'
  return 'i-heroicons-document'
}

async function handleFiles(files: FileList | File[]) {
  if (!videoEditorStore.projectsHandle || !videoEditorStore.currentProjectName) return

  error.value = null
  isLoading.value = true
  try {
    const projectDir = await videoEditorStore.projectsHandle.getDirectoryHandle(videoEditorStore.currentProjectName)
    const sourcesDir = await projectDir.getDirectoryHandle('sources', { create: true })

    for (const file of Array.from(files)) {
      let targetDirName = 'video'
      if (file.type.startsWith('audio/')) targetDirName = 'audio'
      else if (file.type.startsWith('image/')) targetDirName = 'images'
      else if (!file.type.startsWith('video/')) {
        // Default to video or just keep in sources? For now follow the prompt: video/audio/image
        // If it's something else, maybe we skip or put in video as default "source"
        if (file.name.endsWith('.otio')) continue // Skip project files
      }

      const targetDir = await sourcesDir.getDirectoryHandle(targetDirName, { create: true })
      const fileHandle = await targetDir.getFileHandle(file.name, { create: true })
      const writable = await (fileHandle as any).createWritable()
      await writable.write(file)
      await writable.close()
    }

    await loadProjectDirectory()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to upload files'
  } finally {
    isLoading.value = false
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

async function createFolder() {
  if (!videoEditorStore.projectsHandle || !videoEditorStore.currentProjectName) return
  
  const name = prompt(t('common.rename', 'Enter folder name'))
  if (!name) return

  try {
    const projectDir = await videoEditorStore.projectsHandle.getDirectoryHandle(videoEditorStore.currentProjectName)
    await projectDir.getDirectoryHandle(name, { create: true })
    await loadProjectDirectory()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to create folder'
  }
}

function triggerFileUpload() {
  fileInput.value?.click()
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
}
</script>

<template>
  <div
    class="flex flex-col h-full bg-gray-900 border-r border-gray-800 transition-colors duration-200"
    :class="{ 'bg-gray-800/50 ring-2 ring-inset ring-primary-500/50': isDragging }"
    @dragover.prevent="isDragging = true"
    @dragleave.prevent="isDragging = false"
    @drop.prevent="onDrop"
  >
    <!-- Hidden file input -->
    <input
      ref="fileInput"
      type="file"
      multiple
      class="hidden"
      @change="onFileSelect"
    >

    <!-- Header / Tabs -->
    <div class="flex items-center gap-4 px-3 py-2 border-b border-gray-800 shrink-0 select-none">
      <button 
        class="text-xs font-semibold uppercase tracking-wider transition-colors outline-none"
        :class="activeTab === 'files' ? 'text-primary-400' : 'text-gray-500 hover:text-gray-300'"
        @click="activeTab = 'files'"
      >
        {{ t('videoEditor.fileManager.tabs.files', 'Files') }}
      </button>
      <button 
        class="text-xs font-semibold uppercase tracking-wider transition-colors outline-none"
        :class="activeTab === 'effects' ? 'text-primary-400' : 'text-gray-500 hover:text-gray-300'"
        @click="activeTab = 'effects'"
      >
        {{ t('videoEditor.fileManager.tabs.effects', 'Effects') }}
      </button>
    </div>

    <!-- Actions Toolbar (only for Files tab) -->
    <div
      v-if="activeTab === 'files' && videoEditorStore.currentProjectName"
      class="flex items-center gap-1 px-2 py-1 bg-gray-800/30 border-b border-gray-800/50"
    >
      <UButton
        icon="i-heroicons-folder-plus"
        variant="ghost"
        color="neutral"
        size="xs"
        :title="t('videoEditor.fileManager.actions.createFolder')"
        @click="createFolder"
      />
      <UButton
        icon="i-heroicons-arrow-up-tray"
        variant="ghost"
        color="neutral"
        size="xs"
        :title="t('videoEditor.fileManager.actions.uploadFiles')"
        @click="triggerFileUpload"
      />
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto relative">
      <template v-if="activeTab === 'files'">
        <!-- Dropzone Overlay -->
        <div
          v-if="isDragging"
          class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm border-2 border-dashed border-primary-500 m-2 rounded-lg pointer-events-none"
        >
          <UIcon name="i-heroicons-arrow-down-tray" class="w-12 h-12 text-primary-500 mb-2 animate-bounce" />
          <p class="text-sm font-medium text-primary-400">
            {{ t('videoEditor.fileManager.actions.dropFilesHere', 'Drop files here') }}
          </p>
        </div>

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
              ? t('videoEditor.fileManager.empty', 'No files in this project')
              : t('videoEditor.fileManager.unsupported', 'File System Access API is not supported in this browser') }}
          </p>
        </div>

        <!-- Error -->
        <div v-else-if="error" class="px-3 py-4 text-sm text-red-500 bg-red-500/10 m-2 rounded">
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
      </template>

      <template v-else-if="activeTab === 'effects'">
        <div class="flex flex-col items-center justify-center h-full text-gray-600 px-4 text-center">
          <UIcon name="i-heroicons-sparkles" class="w-10 h-10 mb-3" />
          <p class="text-sm italic">
            {{ t('videoEditor.fileManager.tabs.effects', 'Effects') }}
            {{ t('common.noData', '(coming soon)') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
