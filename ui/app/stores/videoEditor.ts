import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVideoEditorStore = defineStore('videoEditor', () => {
  const workspaceHandle = ref<FileSystemDirectoryHandle | null>(null)
  const projectsHandle = ref<FileSystemDirectoryHandle | null>(null)
  const currentProjectName = ref<string | null>(null)
  const currentFileName = ref<string | null>(null)
  
  const projects = ref<string[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isApiSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

  async function openWorkspace() {
    if (!isApiSupported) return
    error.value = null
    isLoading.value = true
    try {
      // Prompt user to select directory
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' })
      workspaceHandle.value = handle

      // Ensure base directories exist
      const folders = ['proxies', 'thumbs', 'cache', 'projects']
      for (const folder of folders) {
        if (folder === 'projects') {
          projectsHandle.value = await handle.getDirectoryHandle(folder, { create: true })
        } else {
          await handle.getDirectoryHandle(folder, { create: true })
        }
      }

      await loadProjects()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        error.value = e?.message ?? 'Failed to open workspace folder'
      }
    } finally {
      isLoading.value = false
    }
  }

  async function loadProjects() {
    if (!projectsHandle.value) return
    
    projects.value = []
    try {
      const iterator = (projectsHandle.value as any).values?.() ?? (projectsHandle.value as any).entries?.()
      if (!iterator) return

      for await (const value of iterator) {
        const handle = Array.isArray(value) ? value[1] : value
        if (handle.kind === 'directory') {
          projects.value.push(handle.name)
        }
      }
      
      projects.value.sort((a, b) => a.localeCompare(b))
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to load projects'
    }
  }

  async function createProject(name: string) {
    if (!projectsHandle.value) {
      error.value = 'Workspace not initialized'
      return
    }
    
    // Check if project exists
    if (projects.value.includes(name)) {
      error.value = 'Project already exists'
      return
    }

    error.value = null
    isLoading.value = true
    try {
      const projectDir = await projectsHandle.value.getDirectoryHandle(name, { create: true })
      
      const sourcesDir = await projectDir.getDirectoryHandle('sources', { create: true })
      await sourcesDir.getDirectoryHandle('video', { create: true })
      await sourcesDir.getDirectoryHandle('audio', { create: true })
      await sourcesDir.getDirectoryHandle('images', { create: true })

      const otioFileName = `${name}_001.otio`
      const otioFile = await projectDir.getFileHandle(otioFileName, { create: true })
      
      // Initialize an empty OpenTimelineIO structure if needed
      const writable = await (otioFile as any).createWritable()
      await writable.write(`{
  "OTIO_SCHEMA": "Timeline.1",
  "name": "${name}",
  "tracks": {
    "OTIO_SCHEMA": "Stack.1",
    "children": [],
    "name": "tracks"
  }
}`)
      await writable.close()

      await loadProjects()
      await openProject(name)
    } catch (e: any) {
      error.value = e?.message ?? 'Failed to create project'
    } finally {
      isLoading.value = false
    }
  }

  async function openProject(name: string) {
    if (!projects.value.includes(name)) {
      error.value = 'Project not found'
      return
    }
    currentProjectName.value = name
    currentFileName.value = `${name}_001.otio` // Just opening the first one by default for now
  }

  function resetWorkspace() {
    workspaceHandle.value = null
    projectsHandle.value = null
    currentProjectName.value = null
    currentFileName.value = null
    projects.value = []
    error.value = null
  }

  return {
    workspaceHandle,
    projectsHandle,
    currentProjectName,
    currentFileName,
    projects,
    isLoading,
    error,
    isApiSupported,
    openWorkspace,
    createProject,
    loadProjects,
    openProject,
    resetWorkspace,
  }
})
