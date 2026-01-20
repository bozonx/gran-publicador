import { ref } from 'vue'
import { useVoiceRecorder } from './useVoiceRecorder'

export function useStt() {
  const { 
    isRecording, 
    recordingDuration, 
    error: recorderError, 
    startRecording, 
    stopRecording,
    requestPermission,
    hasPermission 
  } = useVoiceRecorder({
    onDataAvailable: handleDataAvailable
  })

  const transcription = ref('')
  const isTranscribing = ref(false)
  const error = ref<string | null>(null)
  
  const config = useRuntimeConfig()
  const token = useCookie('auth_token')
  const apiBase = config.public.apiBase
    ? (config.public.apiBase.endsWith('/') ? config.public.apiBase.slice(0, -1) : config.public.apiBase) + '/api/v1'
    : '/api/v1'
  
  let abortController: AbortController | null = null
  let uploadStream: WritableStreamDefaultWriter<Uint8Array> | null = null

  async function handleDataAvailable(blob: Blob) {
    if (!uploadStream) return

    try {
      const buffer = await blob.arrayBuffer()
      // Check if the stream is still writable before writing
      try {
        await uploadStream.write(new Uint8Array(buffer))
      } catch (writeErr) {
        // If write fails, it usually means the fetch failed
        console.warn('Could not write to stream, streaming might have failed:', writeErr)
        uploadStream = null
      }
    } catch (err) {
      console.error('Error processing audio chunk:', err)
      // Only cleanup if it wasn't an intentional stop
      if (isRecording.value) {
        stopAndCleanup()
      }
    }
  }

  async function start() {
    error.value = null
    transcription.value = ''
    
    const permitted = await requestPermission()
    if (!permitted) return false

    abortController = new AbortController()
    
    // Create a readable stream for the fetch body
    const transformStream = new TransformStream()
    const readableStream = transformStream.readable
    uploadStream = transformStream.writable.getWriter()

    isTranscribing.value = true

    // Start upload in background
    let textResult = ''
    const uploadPromise = uploadToBackend(readableStream)
      .then((text) => {
        if (text) textResult = text
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Upload promise error:', err)
          error.value = 'transcriptionError'
        }
      })
      .finally(() => {
        isTranscribing.value = false
      })

    const started = await startRecording()
    if (!started) {
      isTranscribing.value = false
      stopAndCleanup()
      return false
    }

    // Function to wait for upload completion
    const finishUpload = async () => {
      await uploadPromise
      if (textResult) {
        transcription.value = textResult
      }
      return textResult
    }

    // Attach it to the stop function or returned object if needed
    (start as any).finishPromise = finishUpload

    return true
  }

  async function stop() {
    const blob = await stopRecording()
    
    // Close the upload stream if it's still open
    if (uploadStream) {
      try {
        await uploadStream.close()
      } catch (e) {
        console.warn('Error closing upload stream on stop:', e)
      }
      uploadStream = null
    }

    // Wait for the background upload (streaming) to finish
    if ((start as any).finishPromise) {
      try {
        await (start as any).finishPromise
      } catch (e) {
        console.warn('Streaming upload failed, will fallback to full blob:', e)
      }
    }

    // FALLBACK: If streaming transcription failed or returned nothing, try full upload
    if (!transcription.value && blob && blob.size > 0) {
      isTranscribing.value = true
      try {
        const text = await uploadFullBlob(blob)
        if (text) {
          transcription.value = text
        }
      } catch (err) {
        console.error('Fallback upload failed:', err)
        error.value = 'transcriptionError'
      } finally {
        isTranscribing.value = false
      }
    }
    
    return transcription.value
  }

  /**
   * Performs a one-shot upload of the full audio blob.
   * Useful as a fallback when streaming fetch is not supported.
   */
  async function uploadFullBlob(blob: Blob): Promise<string | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': blob.type || 'audio/webm',
      }

      if (token.value) {
        headers.Authorization = `Bearer ${token.value}`
      }

      const response = await fetch(`${apiBase}/stt/transcribe`, {
        method: 'POST',
        body: blob,
        headers
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      return result.text
    } catch (err: any) {
      console.error('STT full blob upload error:', err)
      throw err
    }
  }

  function stopAndCleanup() {
    stopRecording()
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (uploadStream) {
      try {
        // Use abort instead of close if we want to stop immediately
        uploadStream.abort().catch(() => {})
      } catch (e) {}
      uploadStream = null
    }
    isTranscribing.value = false
  }

  async function uploadToBackend(stream: ReadableStream): Promise<string | null> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'audio/webm',
      }

      if (token.value) {
        headers.Authorization = `Bearer ${token.value}`
      }

      const response = await fetch(`${apiBase}/stt/transcribe`, {
        method: 'POST',
        body: stream,
        // @ts-ignore - duplex is required for streaming bodies in fetch
        duplex: 'half',
        signal: abortController?.signal,
        headers
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || `Upload failed with status ${response.status}`)
      }

      const result = await response.json()
      return result.text
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Only log error once, don't throw if we want to fallback gracefully
        console.warn('STT streaming upload error (might be expected in local dev without H2):', err)
        
        // Clean up the writer so handleDataAvailable stops trying to write
        if (uploadStream) {
          uploadStream.abort().catch(() => {})
          uploadStream = null
        }
        
        throw err
      }
      return null
    }
  }

  return {
    isRecording,
    recordingDuration,
    isTranscribing,
    transcription,
    error,
    recorderError,
    hasPermission,
    start,
    stop
  }
}
