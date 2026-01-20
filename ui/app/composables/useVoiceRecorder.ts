import { ref, onUnmounted } from 'vue';

export interface VoiceRecorderOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
  onDataAvailable?: (blob: Blob) => void;
}

export function useVoiceRecorder(options: VoiceRecorderOptions = {}) {
  const isRecording = ref(false);
  const recordingDuration = ref(0);
  const error = ref<string | null>(null);
  const hasPermission = ref<boolean | null>(null);
  const mimeType = ref<string | null>(null);

  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let audioChunks: Blob[] = [];
  let durationInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Request microphone permission.
   */
  async function requestPermission(): Promise<boolean> {
    try {
      error.value = null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Stop the stream immediately, we just needed to check permission
      stream.getTracks().forEach(track => track.stop());

      hasPermission.value = true;
      return true;
    } catch (err: any) {
      console.error('Microphone permission error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        error.value = 'microphonePermissionDenied';
      } else if (err.name === 'NotFoundError') {
        error.value = 'microphoneNotAvailable';
      } else {
        error.value = 'recordingError';
      }

      hasPermission.value = false;
      return false;
    }
  }

  /**
   * Start recording audio.
   */
  async function startRecording(): Promise<boolean> {
    try {
      error.value = null;
      audioChunks = [];
      recordingDuration.value = 0;

      // Get microphone stream
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine the best supported MIME type
      const selectedMimeType = options.mimeType || getSupportedMimeType();

      const recorderOptions: MediaRecorderOptions = {
        mimeType: selectedMimeType,
      };

      if (options.audioBitsPerSecond) {
        recorderOptions.audioBitsPerSecond = options.audioBitsPerSecond;
      }

      mediaRecorder = new MediaRecorder(mediaStream, recorderOptions);
      mimeType.value = selectedMimeType;

      // Collect audio chunks
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          if (options.onDataAvailable) {
            options.onDataAvailable(event.data);
          }
        }
      };

      mediaRecorder.onerror = (event: Event) => {
        console.error('MediaRecorder error:', event);
        error.value = 'recordingError';
        stopRecording();
      };

      // Start recording
      mediaRecorder.start(1000); // Collect data every 1 second
      isRecording.value = true;
      hasPermission.value = true;

      // Start duration counter
      durationInterval = setInterval(() => {
        recordingDuration.value++;
      }, 1000);

      return true;
    } catch (err: any) {
      console.error('Start recording error:', err);

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        error.value = 'microphonePermissionDenied';
      } else if (err.name === 'NotFoundError') {
        error.value = 'microphoneNotAvailable';
      } else {
        error.value = 'recordingError';
      }

      cleanup();
      return false;
    }
  }

  /**
   * Stop recording and return the audio blob.
   */
  async function stopRecording(): Promise<Blob | null> {
    return new Promise(resolve => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        cleanup();
        resolve(audioBlob);
      };

      mediaRecorder.stop();
    });
  }

  /**
   * Get supported MIME type for audio recording.
   */
  function getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm'; // fallback
  }

  /**
   * Cleanup resources.
   */
  function cleanup() {
    isRecording.value = false;
    mimeType.value = null;

    if (durationInterval) {
      clearInterval(durationInterval);
      durationInterval = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    mediaRecorder = null;
  }

  /**
   * Cleanup on component unmount.
   */
  onUnmounted(() => {
    cleanup();
  });

  return {
    isRecording,
    recordingDuration,
    error,
    hasPermission,
    mimeType,
    audioChunks,
    requestPermission,
    startRecording,
    stopRecording,
  };
}
