import type { ApiToken, CreateApiTokenDto, UpdateApiTokenDto } from '~/types/api-tokens.types'

export function useApiTokens() {
  const api = useApi()
  const toast = useToast()

  const tokens = ref<ApiToken[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTokens() {
    loading.value = true
    error.value = null

    try {
      const response = await api.get('/api-tokens')
      tokens.value = response
      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch API tokens'
      toast.add({
        title: 'Error',
        description: error.value,
        color: 'error',
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function createToken(dto: CreateApiTokenDto): Promise<ApiToken> {
    loading.value = true
    error.value = null

    try {
      const response = await api.post('/api-tokens', dto)
      tokens.value.unshift(response)

      toast.add({
        title: 'Success',
        description: 'API token created successfully',
        color: 'success',
      })

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to create API token'
      toast.add({
        title: 'Error',
        description: error.value,
        color: 'error',
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateToken(id: string, dto: UpdateApiTokenDto): Promise<ApiToken> {
    loading.value = true
    error.value = null

    try {
      const response = await api.patch(`/api-tokens/${id}`, dto)

      const index = tokens.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        tokens.value[index] = response
      }

      toast.add({
        title: 'Success',
        description: 'API token updated successfully',
        color: 'success',
      })

      return response
    } catch (err: any) {
      error.value = err.message || 'Failed to update API token'
      toast.add({
        title: 'Error',
        description: error.value,
        color: 'error',
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteToken(id: string): Promise<void> {
    loading.value = true
    error.value = null

    try {
      await api.delete(`/api-tokens/${id}`)
      tokens.value = tokens.value.filter((t) => t.id !== id)

      toast.add({
        title: 'Success',
        description: 'API token deleted successfully',
        color: 'success',
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to delete API token'
      toast.add({
        title: 'Error',
        description: error.value,
        color: 'error',
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token)
      toast.add({
        title: 'Copied',
        description: 'Token copied to clipboard',
        color: 'success',
      })
    } catch (err) {
      toast.add({
        title: 'Error',
        description: 'Failed to copy token',
        color: 'error',
      })
    }
  }

  return {
    tokens,
    loading,
    error,
    fetchTokens,
    createToken,
    updateToken,
    deleteToken,
    copyToken,
  }
}
