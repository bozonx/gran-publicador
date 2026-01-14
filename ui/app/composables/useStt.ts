import { ref } from 'vue'

export function useStt() {
  const { post } = useApi()
  const isTranscribing = ref(false)
  const error = ref<string | null>(null)

  /**
   * Transcribe audio using STT API.
   */
  async function transcribeAudio(audioBlob: Blob): Promise<string | null> {
    isTranscribing.value = true
    error.value = null
    console.log('STT: Starting audio transcription')

    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await post<{ text: string }>('/stt/transcribe', formData)
      console.log('STT: Transcription successful:', response)

      return response.text
    } catch (err: any) {
      const msg = err.data?.message || err.message || 'Failed to transcribe audio'
      error.value = msg
      console.error('STT: Transcription error:', err)
      return null
    } finally {
      isTranscribing.value = false
    }
  }

  return {
    isTranscribing,
    error,
    transcribeAudio,
  }
}
