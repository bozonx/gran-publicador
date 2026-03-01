import { ref } from 'vue';
import { defineStore } from 'pinia';

export interface SttSocket {
  connected: boolean;
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener?: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  disconnect(): void;
}

/**
 * STT store using Dumb Store pattern.
 * Logic is moved to useStt.ts composable.
 */
export const useSttStore = defineStore('stt', () => {
  const socket = ref<SttSocket | null>(null);
  const transcription = ref('');
  const isTranscribing = ref(false);
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const error = ref<string | null>(null);

  function setSocket(newSocket: SttSocket | null) {
    socket.value = newSocket;
  }

  function setTranscription(text: string) {
    transcription.value = text;
  }

  function setIsTranscribing(value: boolean) {
    isTranscribing.value = value;
  }

  function setIsRecording(value: boolean) {
    isRecording.value = value;
  }

  function setRecordingDuration(value: number) {
    recordingDuration.value = value;
  }

  function setError(newError: string | null) {
    error.value = newError;
  }

  function reset() {
    if (socket.value) {
      socket.value.disconnect();
    }
    socket.value = null;
    transcription.value = '';
    isTranscribing.value = false;
    isRecording.value = false;
    recordingDuration.value = 0;
    error.value = null;
  }

  return {
    socket,
    transcription,
    isTranscribing,
    isRecording,
    recordingDuration,
    error,
    setSocket,
    setTranscription,
    setIsTranscribing,
    setIsRecording,
    setRecordingDuration,
    setError,
    reset,
  };
});
