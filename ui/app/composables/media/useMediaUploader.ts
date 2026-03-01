import { ref, computed } from 'vue'
import type { MediaLinkItem } from '~/types/media'
import { DEFAULT_MEDIA_OPTIMIZATION_SETTINGS } from '~/utils/media-presets'

interface UseMediaUploaderOptions {
  props: any
  currentProject: any
  uploadMedia: (file: File, onProgress: (progress: number) => void, options?: any, projectId?: string) => Promise<any>
  uploadMediaFromUrl: (url: string, filename?: string, options?: any) => Promise<any>
  addMediaToPublication: (publicationId: string, media: any[]) => Promise<any>
  createMedia: (media: any) => Promise<any>
  t: any
  toast: any
  emit: (e: 'refresh') => void
}

export function useMediaUploader({
  props,
  currentProject,
  uploadMedia,
  uploadMediaFromUrl,
  addMediaToPublication,
  createMedia,
  t,
  toast,
  emit
}: UseMediaUploaderOptions) {
  const fileInput = ref<any>(null)
  const uploadProgress = ref(false)
  const uploadProgressPercent = ref(0)
  const sourceType = ref<'URL' | 'TELEGRAM'>('URL')
  const mediaType = ref<'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'>('IMAGE')
  const sourceInput = ref('')
  const filenameInput = ref('')
  const stagedFiles = ref<File[]>([])
  const showExtendedOptions = ref(false)
  const optimizationSettings = ref<any>(JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS)))
  const isAddingMedia = ref(false)

  const currentProjectOptimization = computed(() => {
    return currentProject.value?.preferences?.mediaOptimization
  })

  function getDefaultOptimizationParams() {
    const projectOpt = currentProjectOptimization.value
    if (projectOpt) {
      return JSON.parse(JSON.stringify(projectOpt))
    }
    return JSON.parse(JSON.stringify(DEFAULT_MEDIA_OPTIMIZATION_SETTINGS))
  }

  async function uploadFiles(files: FileList | File[], options?: any) {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    uploadProgress.value = true
    uploadProgressPercent.value = 0
    
    const progresses = new Array(fileArray.length).fill(0)
    
    const optimizeParams = options

    try {
        const uploadedMediaItems = await Promise.all(
          fileArray.map(async (file, index) => {
            return await uploadMedia(file, (progress) => {
              progresses[index] = progress
              const totalProgress = progresses.reduce((a, b) => a + b, 0)
              uploadProgressPercent.value = Math.round(totalProgress / fileArray.length)
            }, optimizeParams, currentProject.value?.id)
          })
        ) as any[]
        
        if (props.publicationId) {
          await addMediaToPublication(
            props.publicationId, 
            uploadedMediaItems.map(m => ({ id: m.id }))
          )
        } else if (props.onAdd) {
          await props.onAdd(uploadedMediaItems)
        }
      
      emit('refresh')
    } catch (error: any) {
      toast.add({
        title: t('common.error'),
        description: t('media.uploadError', 'Failed to upload files'),
        color: 'error',
      })
    } finally {
      uploadProgress.value = false
      uploadProgressPercent.value = 0
    }
  }

  async function addMedia() {
    if (!sourceInput.value.trim()) return

    uploadProgress.value = true
    try {
      let uploadedMedia: any

      if (sourceType.value === 'URL') {
        const defaults = getDefaultOptimizationParams()
        const optimizeParams = showExtendedOptions.value
          ? optimizationSettings.value
          : defaults

        uploadedMedia = await uploadMediaFromUrl(
          sourceInput.value.trim(),
          filenameInput.value.trim() || undefined,
          optimizeParams
        )
      } else {
        const newMedia: any = {
          type: mediaType.value,
          storageType: 'TELEGRAM',
          storagePath: sourceInput.value.trim(),
          filename: filenameInput.value.trim() || undefined,
        }
        
        if (props.publicationId) {
          await addMediaToPublication(props.publicationId, [newMedia])
        } else if (props.onAdd) {
          const created = await createMedia(newMedia)
          await props.onAdd([created])
        }
        
        sourceInput.value = ''
        filenameInput.value = ''
        isAddingMedia.value = false
        emit('refresh')
        return
      }

      if (props.publicationId) {
        await addMediaToPublication(props.publicationId, [{ id: uploadedMedia.id }])
      } else if (props.onAdd) {
        await props.onAdd([uploadedMedia])
      }
      
      sourceInput.value = ''
      filenameInput.value = ''
      isAddingMedia.value = false
      emit('refresh')
    } catch (error: any) {
      toast.add({
        title: t('common.error'),
        description: t('media.addError', 'Failed to add media'),
        color: 'error',
      })
    } finally {
      uploadProgress.value = false
    }
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement
    if (target.files?.length) {
      const files = Array.from(target.files)
      if (showExtendedOptions.value) {
        stagedFiles.value.push(...files)
      } else {
        const defaults = getDefaultOptimizationParams()
        await uploadFiles(files, defaults)
      }
      target.value = ''
    }
  }

  async function confirmAndUploadExtended() {
    if (stagedFiles.value.length === 0 && !sourceInput.value.trim()) return

    uploadProgress.value = true
    try {
      if (stagedFiles.value.length > 0) {
        await uploadFiles(stagedFiles.value, optimizationSettings.value)
        stagedFiles.value = []
      }

      if (sourceInput.value.trim()) {
        await addMedia()
      }

      isAddingMedia.value = false
      showExtendedOptions.value = false
    } catch (error) {
       // Handled in subfunctions
    } finally {
      uploadProgress.value = false
    }
  }

  function removeStagedFile(index: number) {
    stagedFiles.value.splice(index, 1)
  }

  function toggleExtendedOptions() {
    showExtendedOptions.value = !showExtendedOptions.value
    isAddingMedia.value = showExtendedOptions.value
  }

  function triggerFileInput() {
    fileInput.value?.triggerFileInput()
  }

  return {
    fileInput,
    uploadProgress,
    uploadProgressPercent,
    sourceType,
    mediaType,
    sourceInput,
    filenameInput,
    stagedFiles,
    showExtendedOptions,
    optimizationSettings,
    isAddingMedia,
    currentProjectOptimization,
    getDefaultOptimizationParams,
    uploadFiles,
    addMedia,
    handleFileUpload,
    confirmAndUploadExtended,
    removeStagedFile,
    toggleExtendedOptions,
    triggerFileInput
  }
}
