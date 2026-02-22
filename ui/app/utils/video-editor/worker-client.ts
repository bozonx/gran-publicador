import { createChannel } from 'bidc';
import type { VideoCoreWorkerAPI } from './worker-rpc';

export interface VideoCoreHostAPI {
  getFileHandleByPath(path: string): Promise<FileSystemFileHandle | null>;
  onExportProgress(progress: number): void;
}

let channelInstance: ReturnType<typeof createChannel> | null = null;
let workerInstance: Worker | null = null;
let hostApiInstance: VideoCoreHostAPI | null = null;

export function setHostApi(api: VideoCoreHostAPI) {
  hostApiInstance = api;
}

export function getWorkerClient(): { client: VideoCoreWorkerAPI; worker: Worker } {
  if (!workerInstance || !channelInstance) {
    workerInstance = new Worker(new URL('../../workers/video-core.worker.ts', import.meta.url), {
      type: 'module',
      name: 'video-core',
    });

    channelInstance = createChannel(workerInstance);

    // Host handles messages from the worker
    channelInstance.receive(async (data: any) => {
      if (data && data.type === 'rpc' && hostApiInstance) {
        const method = data.method as keyof VideoCoreHostAPI;
        if (typeof hostApiInstance[method] === 'function') {
          return (hostApiInstance[method] as any)(...(data.args || []));
        }
      }
    });
  }

  // Create a Proxy to easily call worker methods
  const clientAPI = new Proxy({}, {
    get(_, method: string) {
      if (method === 'initCompositor') {
        return async (canvas: OffscreenCanvas, width: number, height: number, bgColor: string) => {
          workerInstance!.postMessage({ type: 'initCanvas', canvas, width, height, bgColor }, [canvas]);
          // Wait for a brief moment to ensure worker processes message
          await new Promise(r => setTimeout(r, 50));
        };
      }
      return async (...args: any[]) => {
        return channelInstance!.send({ type: 'rpc', method, args });
      };
    }
  }) as VideoCoreWorkerAPI;

  return {
    client: clientAPI,
    worker: workerInstance,
  };
}
