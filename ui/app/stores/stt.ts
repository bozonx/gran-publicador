import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io } from 'socket.io-client';
import { useAuthStore } from './auth';

export interface SttSocket {
  connected: boolean;
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener?: (...args: any[]) => void): void;
  once(event: string, listener: (...args: any[]) => void): void;
  disconnect(): void;
}

export const useSttStore = defineStore('stt', () => {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const socket = ref<SttSocket | null>(null);

  /**
   * Connect to WebSocket for STT
   */
  function connect(): SttSocket {
    if (socket.value) return socket.value;

    const apiBase = config.public.apiBase || '';
    let wsUrl = '';

    if (apiBase.startsWith('http')) {
      const url = new URL(apiBase);
      wsUrl = url.origin;
    } else {
      wsUrl = window.location.origin;
    }

    const token =
      ((authStore as any).accessToken?.value as string | null | undefined) ??
      ((authStore as any).accessToken as string | null | undefined) ??
      null;

    socket.value = io(`${wsUrl}/stt`, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      transports: ['websocket'],
    }) as unknown as SttSocket;

    socket.value.on('connect_error', error => {
      console.error('STT WebSocket connection error', error);
    });

    return socket.value!;
  }

  /**
   * Disconnect from WebSocket
   */
  function disconnect() {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  }

  return {
    socket,
    connect,
    disconnect,
  };
});
