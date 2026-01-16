import { ref } from 'vue'
import type { 
  AuthorSignature, 
  PresetSignature, 
  CreateAuthorSignatureInput, 
  UpdateAuthorSignatureInput 
} from '~/types/author-signatures'

export function useAuthorSignatures() {
  const api = useApi()
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchByChannel(channelId: string): Promise<AuthorSignature[]> {
    isLoading.value = true
    error.value = null
    try {
      return await api.get<AuthorSignature[]>(`/author-signatures/channel/${channelId}`)
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch signatures'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchPresets(): Promise<PresetSignature[]> {
    isLoading.value = true
    error.value = null
    try {
      return await api.get<PresetSignature[]>('/author-signatures/presets')
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch preset signatures'
      return []
    } finally {
      isLoading.value = false
    }
  }

  async function create(data: CreateAuthorSignatureInput): Promise<AuthorSignature | null> {
    isLoading.value = true
    error.value = null
    try {
      return await api.post<AuthorSignature>('/author-signatures', data)
    } catch (err: any) {
      error.value = err.message || 'Failed to create signature'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function update(id: string, data: UpdateAuthorSignatureInput): Promise<AuthorSignature | null> {
    isLoading.value = true
    error.value = null
    try {
      return await api.patch<AuthorSignature>(`/author-signatures/${id}`, data)
    } catch (err: any) {
      error.value = err.message || 'Failed to update signature'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function deleteSignature(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.delete(`/author-signatures/${id}`)
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to delete signature'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function setDefault(id: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      await api.post(`/author-signatures/${id}/default`, {})
      return true
    } catch (err: any) {
      error.value = err.message || 'Failed to set default signature'
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    fetchByChannel,
    fetchPresets,
    create,
    update,
    deleteSignature,
    setDefault
  }
}
