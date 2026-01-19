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
  
  let abortController: AbortController | null = null
  let uploadStream: WritableStreamDefaultWriter<Uint8Array> | null = null

  async function handleDataAvailable(blob: Blob) {
    if (!uploadStream) return

    try {
      const buffer = await blob.arrayBuffer()
      await uploadStream.write(new Uint8Array(buffer))
    } catch (err) {
      console.error('Error writing to upload stream:', err)
      stopAndCleanup()
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
    if (uploadStream) {
      try {
        await uploadStream.close()
      } catch (e) {}
      uploadStream = null
    }

    // Wait for the background upload to finish
    if ((start as any).finishPromise) {
      await (start as any).finishPromise
    }
    
    return transcription.value
  }

  function stopAndCleanup() {
    stopRecording()
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    if (uploadStream) {
      try {
        uploadStream.close()
      } catch (e) {}
      uploadStream = null
    }
    isTranscribing.value = false
  }

  async function uploadToBackend(stream: ReadableStream): Promise<string | null> {
    try {
      const response = await fetch('/api/v1/stt/transcribe', {
        method: 'POST',
        body: stream,
        // @ts-ignore - duplex is required for streaming bodies in fetch
        duplex: 'half',
        signal: abortController?.signal,
        headers: {
          'Content-Type': 'audio/webm',
        }
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.message || 'Upload failed')
      }

      const result = await response.json()
      return result.text
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('STT upload error:', err)
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
