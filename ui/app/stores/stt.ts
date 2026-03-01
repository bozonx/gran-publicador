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

  function setSocket(newSocket: SttSocket | null) {
    socket.value = newSocket;
  }

  function reset() {
    if (socket.value) {
      socket.value.disconnect();
    }
    socket.value = null;
  }

  return {
    socket,
    setSocket,
    reset,
  };
});
