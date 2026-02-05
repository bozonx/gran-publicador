import { ref } from 'vue';
import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth';

export const useSttStore = defineStore('stt', () => {
  const authStore = useAuthStore();
  const config = useRuntimeConfig();

  const socket = ref<Socket | null>(null);

  /**
   * Connect to WebSocket for STT
   */
  function connect() {
    if (socket.value) return socket.value;

    const apiBase = config.public.apiBase || '';
    let wsUrl = '';

    if (apiBase.startsWith('http')) {
      const url = new URL(apiBase);
      wsUrl = url.origin;
    } else {
      wsUrl = window.location.origin;
    }

    socket.value = io(`${wsUrl}/stt`, {
      auth: {
        token: authStore.accessToken,
      },
      transports: ['websocket'],
    });

    socket.value.on('connect_error', error => {
      console.error('STT WebSocket connection error', error);
    });

    return socket.value;
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
