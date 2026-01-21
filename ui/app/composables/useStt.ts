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

  // Track pending chunk uploads to ensure sequence
  const pendingChunks = ref<Promise<void>[]>([]);

  async function handleDataAvailable(blob: Blob) {
    if (!socket || !socket.connected) return;

    const chunkPromise = (async () => {
      try {
        // Send Blob directly if supported -> but safer to ensure ArrayBuffer for consistency
        const buffer = await blob.arrayBuffer();
        socket?.emit('audio-chunk', buffer);
      } catch (err) {
        console.error('Error sending audio chunk via WebSocket:', err);
      }
    })();

    pendingChunks.value.push(chunkPromise);
    // Cleanup finished promises to avoid memory leaks
    chunkPromise.finally(() => {
      const index = pendingChunks.value.indexOf(chunkPromise);
      if (index > -1) pendingChunks.value.splice(index, 1);
    });
  }

  function setupSocketListeners() {
    if (!socket) return () => {};

    const onResult = (data: { text: string }) => {
      transcription.value = data.text;
      isTranscribing.value = false;
    };

    const onError = (data: { message: string }) => {
      console.error('STT transcription error:', data.message);
      error.value = 'transcriptionError';
      isTranscribing.value = false;
    };

    const onDisconnect = () => {
      if (isTranscribing.value) {
        error.value = 'connectionLost';
        isTranscribing.value = false;
      }
    };

    socket.on('transcription-result', onResult);
    socket.on('transcription-error', onError);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket?.off('transcription-result', onResult);
      socket?.off('transcription-error', onError);
      socket?.off('disconnect', onDisconnect);
    };
  }

  let stopSocketListeners: (() => void) | null = null;

  function cleanupListeners() {
    if (stopSocketListeners) {
      stopSocketListeners();
      stopSocketListeners = null;
    }
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

    cleanupListeners();
    stopSocketListeners = setupSocketListeners();
    
    // isTranscribing should not be true during recording to avoid disabling the stop button
    isTranscribing.value = false;

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
    await stopRecording();
    
    if (socket && socket.connected) {
      isTranscribing.value = true;
      
      // Wait for all pending chunks to be sent
      if (pendingChunks.value.length > 0) {
        await Promise.all([...pendingChunks.value]);
      }

      socket.emit('transcribe-end');
      
      const result = await waitForTranscription();
      isTranscribing.value = false;
      return result;
    } else {
      isTranscribing.value = false;
      cleanupListeners();
      return '';
    }
  }

  /**
   * One-shot transcription for a full blob (compatibility with LlmGeneratorModal)
   */
  async function transcribeAudio(blob: Blob): Promise<string> {
    error.value = null;
    transcription.value = '';

    socket = sttStore.connect();
    if (!socket) {
      error.value = 'socketConnectionError';
      return '';
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

    cleanupListeners();
    // For one-shot, we might not need long-lived listeners, 
    // but better to have them for consistency or just rely on waitForTranscription
    
    isTranscribing.value = true;
    socket.emit('transcribe-start', {
      mimetype: blob.type || 'audio/webm',
      filename: 'recording.webm',
    });

    const buffer = await blob.arrayBuffer();
    socket.emit('audio-chunk', buffer);
    socket.emit('transcribe-end');

    const result = await waitForTranscription();
    isTranscribing.value = false;
    return result;
  }

  function waitForTranscription(): Promise<string> {
    return new Promise<string>((resolve) => {
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        socket?.off('transcription-result', handleResult);
        socket?.off('transcription-error', handleError);
        socket?.off('disconnect', handleDisconnect);
        clearTimeout(timeoutId);
      };

      const handleResult = (data: { text: string }) => {
        cleanup();
        transcription.value = data.text;
        resolve(data.text);
      };

      const handleError = (data?: { message: string }) => {
        console.error('STT Error received:', data?.message);
        cleanup();
        error.value = 'transcriptionError';
        resolve('');
      };

      const handleDisconnect = () => {
        console.warn('Socket disconnected while waiting for transcription');
        cleanup();
        error.value = 'connectionLost';
        resolve('');
      };

      socket?.on('transcription-result', handleResult);
      socket?.on('transcription-error', handleError);
      socket?.on('disconnect', handleDisconnect);

      // Safety timeout - 5 minutes
      timeoutId = setTimeout(() => {
        console.error('Transcription timed out');
        cleanup();
        error.value = 'timeout'; 
        resolve('');
      }, 300000);
    });
  }

  onUnmounted(() => {
    cleanupListeners();
  });

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
    transcribeAudio,
  };
}
