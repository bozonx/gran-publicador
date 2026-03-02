import { ref, watch, onUnmounted } from 'vue';
import { io } from 'socket.io-client';
import { storeToRefs } from 'pinia';
import { useVoiceRecorder } from './useVoiceRecorder';
import { useSttStore } from '../stores/stt';
import type { SttSocket } from '../stores/stt';

export function useStt() {
  const sttStore = useSttStore();
  const { 
    transcription, 
    isTranscribing, 
    isRecording: storeIsRecording, 
    recordingDuration: storeRecordingDuration, 
    error 
  } = storeToRefs(sttStore);

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

  // Sync recorder state to store
  watch(isRecording, (val) => sttStore.setIsRecording(val));
  watch(recordingDuration, (val) => sttStore.setRecordingDuration(val));
  watch(recorderError, (val) => {
    if (val) sttStore.setError('recorderError');
  });

  let socket: SttSocket | null = null;

  // Track pending chunk uploads to ensure sequence
  const pendingChunks = ref<Promise<void>[]>([]);

  let activeWaitCleanup: (() => void) | null = null;

  const detachSocketListeners = () => {
    if (!socket) return;
    socket.off('transcription-error', handleSocketTranscriptionError);
    socket.off('disconnect', handleSocketDisconnect);
    socket.off('error', handleSocketError);
  };

  const attachSocketListeners = () => {
    if (!socket) return;
    detachSocketListeners();
    socket.on('transcription-error', handleSocketTranscriptionError);
    socket.on('disconnect', handleSocketDisconnect);
    socket.on('error', handleSocketError);
  };

  const stopAllActivityOnError = () => {
    sttStore.setIsTranscribing(false);
    sttStore.setIsRecording(false);

    activeWaitCleanup?.();
    activeWaitCleanup = null;

    void (async () => {
      try {
        await stopRecording();
      } catch {
        // ignore
      }
    })();
  };

  const handleSocketTranscriptionError = (data?: { message: string }) => {
    console.error('STT Error received:', data?.message);
    sttStore.setError('transcriptionError');
    stopAllActivityOnError();
  };

  const handleSocketError = (err: any) => {
    console.error('STT Socket error:', err);
    sttStore.setError('socketConnectionError');
    stopAllActivityOnError();
  };

  const handleSocketDisconnect = () => {
    if (!storeIsRecording.value && !isTranscribing.value) return;
    console.warn('STT Socket disconnected');
    sttStore.setError('connectionLost');
    stopAllActivityOnError();
  };

  async function handleDataAvailable(blob: Blob) {
    if (!socket || !socket.connected) return;

    const chunkPromise = (async () => {
      try {
        // Send Blob directly if supported -> but safer to ensure ArrayBuffer for consistency
        const buffer = await blob.arrayBuffer();
        socket.emit('audio-chunk', buffer);
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

  async function ensureConnected(): Promise<SttSocket | null> {
    if (sttStore.socket) {
      socket = sttStore.socket;
      attachSocketListeners();
      return socket;
    }

    const config = useRuntimeConfig();
    const apiBase = config.public.apiBase || '';
    let wsUrl: string

    if (apiBase.startsWith('http')) {
      const url = new URL(apiBase);
      wsUrl = url.origin;
    } else {
      wsUrl = window.location.origin;
    }

    const newSocket = io(`${wsUrl}/stt`, {
      withCredentials: true,
      transports: ['websocket'],
    }) as unknown as SttSocket;

    newSocket.on('connect_error', (err: any) => {
      console.error('STT WebSocket connection error', err);
      // Don't set error here, let the promise rejection handle it
    });

    socket = newSocket;
    sttStore.setSocket(newSocket);
    attachSocketListeners();

    if (!newSocket.connected) {
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
          newSocket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
          newSocket.once('connect_error', (err: any) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } catch (err) {
        console.error('STT socket connection failed:', err);
        sttStore.setError('socketConnectionError');
        // Clean up broken socket so next attempt creates a fresh one
        detachSocketListeners();
        newSocket.disconnect();
        sttStore.setSocket(null);
        socket = null;
        return null;
      }
    }

    return newSocket;
  }

  async function start(language?: string) {
    sttStore.setError(null);
    sttStore.setTranscription('');

    const permitted = await requestPermission();
    if (!permitted) return false;

    const connectedSocket = await ensureConnected();
    if (!connectedSocket) return false;

    connectedSocket.emit('transcribe-start', {
      mimetype: mimeType.value || 'audio/webm',
      filename: `recording-${Date.now()}.webm`,
      language,
    });

    const started = await startRecording();
    if (!started) {
      return false;
    }

    return true;
  }

  async function stop() {
    try {
      await stopRecording();

      if (!socket || !socket.connected) {
        sttStore.setIsTranscribing(false);
        return '';
      }

      sttStore.setIsTranscribing(true);

      // Prepare listeners BEFORE sending transcribe-end to avoid missing fast error/result events
      const waitPromise = waitForTranscription();

      // Wait for all pending chunks to be sent
      if (pendingChunks.value.length > 0) {
        await Promise.all([...pendingChunks.value]);
      }

      socket.emit('transcribe-end');
      return await waitPromise;
    } finally {
      sttStore.setIsTranscribing(false);
    }
  }

  function cancel() {
    try {
      stopRecording().catch(() => {});
      activeWaitCleanup?.();
      activeWaitCleanup = null;
      if (socket && socket.connected) {
        socket.emit('transcribe-cancel');
      }
      sttStore.setError('cancelled');
    } finally {
      sttStore.setIsTranscribing(false);
    }
  }

  /**
   * One-shot transcription for a full blob (compatibility with LlmGeneratorModal)
   */
  async function transcribeAudio(blob: Blob, language?: string): Promise<string> {
    sttStore.setError(null);
    sttStore.setTranscription('');

    const connectedSocket = await ensureConnected();
    if (!connectedSocket) return '';

    try {
      sttStore.setIsTranscribing(true);

      // Prepare listeners BEFORE sending transcribe-end to avoid missing fast error/result events
      const waitPromise = waitForTranscription();

      connectedSocket.emit('transcribe-start', {
        mimetype: blob.type || 'audio/webm',
        filename: 'recording.webm',
        language,
      });

      const buffer = await blob.arrayBuffer();
      connectedSocket.emit('audio-chunk', buffer);
      connectedSocket.emit('transcribe-end');

      return await waitPromise;
    } finally {
      sttStore.setIsTranscribing(false);
    }
  }

  function waitForTranscription(): Promise<string> {
    return new Promise<string>(resolve => {
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        socket?.off('transcription-result', handleResult);
        socket?.off('transcription-error', handleWaitError);
        socket?.off('disconnect', handleWaitDisconnect);
        clearTimeout(timeoutId);
      };

      activeWaitCleanup = () => {
        cleanup();
        resolve('');
      };

      const handleResult = (data: { text: string }) => {
        cleanup();
        activeWaitCleanup = null;
        sttStore.setTranscription(data.text);
        resolve(data.text);
      };

      const handleWaitError = (data?: { message: string }) => {
        console.error('STT Error received while waiting:', data?.message);
        cleanup();
        activeWaitCleanup = null;
        sttStore.setError('transcriptionError');
        stopAllActivityOnError();
        resolve('');
      };

      const handleWaitDisconnect = () => {
        console.warn('Socket disconnected while waiting for transcription');
        cleanup();
        activeWaitCleanup = null;
        sttStore.setError('connectionLost');
        stopAllActivityOnError();
        resolve('');
      };

      socket?.on('transcription-result', handleResult);
      socket?.once('transcription-error', handleWaitError);
      socket?.once('disconnect', handleWaitDisconnect);

      // Safety timeout - 10 minutes
      timeoutId = setTimeout(() => {
        console.error('Transcription timed out');
        cleanup();
        activeWaitCleanup = null;
        sttStore.setError('timeout');
        resolve('');
      }, 600000);
    });
  }

  onUnmounted(() => {
    // Keep socket connection in store, only cleanup local listeners
    detachSocketListeners();
    socket?.off('transcription-result');
  });

  // Reset STT state on recorder error
  watch(
    () => recorderError.value,
    newError => {
      if (newError) {
        stopAllActivityOnError();
      }
    },
  );

  return {
    isRecording: storeIsRecording,
    recordingDuration: storeRecordingDuration,
    isTranscribing,
    transcription,
    error,
    recorderError,
    hasPermission,
    start,
    stop,
    cancel,
    transcribeAudio,
  };
}
