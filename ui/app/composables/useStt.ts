import { ref, onUnmounted } from 'vue';
import { useVoiceRecorder } from './useVoiceRecorder';
import { useSttStore } from '../stores/stt';

export function useStt() {
  const sttStore = useSttStore();
  const {
    isRecording,
    recordingDuration,
    error: recorderError,
    mimeType,
    startRecording,
    stopRecording,
    requestPermission,
    hasPermission,
  } = useVoiceRecorder({
    onDataAvailable: handleDataAvailable,
  });

  const transcription = ref('');
  const isTranscribing = ref(false);
  const error = ref<string | null>(null);

  // Use a local ref that we update when socket connects
  let socket = sttStore.socket;

  async function handleDataAvailable(blob: Blob) {
    if (!socket || !socket.connected) return;

    try {
      const buffer = await blob.arrayBuffer();
      socket.emit('audio-chunk', buffer);
    } catch (err) {
      console.error('Error sending audio chunk via WebSocket:', err);
    }
  }

  function setupSocketListeners() {
    if (!socket) return;

    socket.on('transcription-result', (data: { text: string }) => {
      transcription.value = data.text;
      isTranscribing.value = false;
      cleanupListeners();
    });

    socket.on('transcription-error', (data: { message: string }) => {
      console.error('STT transcription error:', data.message);
      error.value = 'transcriptionError';
      isTranscribing.value = false;
      cleanupListeners();
    });

    socket.on('disconnect', () => {
      if (isTranscribing.value) {
        error.value = 'connectionLost';
        isTranscribing.value = false;
      }
      cleanupListeners();
    });
  }

  function cleanupListeners() {
    if (!socket) return;
    socket.off('transcription-result');
    socket.off('transcription-error');
    socket.off('disconnect');
  }

  async function start() {
    error.value = null;
    transcription.value = '';

    const permitted = await requestPermission();
    if (!permitted) return false;

    // Ensure socket is connected
    socket = sttStore.connect();
    if (!socket) {
      error.value = 'socketConnectionError';
      return false;
    }

    if (!socket.connected) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
        socket!.once('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    setupSocketListeners();
    isTranscribing.value = true;

    socket.emit('transcribe-start', {
      mimetype: mimeType.value || 'audio/webm',
      filename: `recording-${Date.now()}.webm`,
    });

    const started = await startRecording();
    if (!started) {
      isTranscribing.value = false;
      cleanupListeners();
      return false;
    }

    return true;
  }

  async function stop() {
    const blob = await stopRecording();
    
    if (socket && socket.connected) {
      socket.emit('transcribe-end');
    } else {
      isTranscribing.value = false;
      cleanupListeners();
    }

    // We don't wait for result here as it comes asynchronously via 'transcription-result' event
    // The UI should watch `isTranscribing` and `transcription`
    return ''; 
  }

  onUnmounted(() => {
    cleanupListeners();
  });

  return {
    isRecording,
    recordingDuration,
    isTranscribing,
    transcription,
    error,
    recorderError,
    hasPermission,
    start,
    stop,
  };
}
