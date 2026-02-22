import type { VideoCoreWorkerAPI } from './worker-rpc';

export interface VideoCoreHostAPI {
  getFileHandleByPath(path: string): Promise<FileSystemFileHandle | null>;
  onExportProgress(progress: number): void;
}

let workerInstance: Worker | null = null;
let hostApiInstance: VideoCoreHostAPI | null = null;

let callIdCounter = 0;
const pendingCalls = new Map<number, { resolve: Function, reject: Function }>();

export function setHostApi(api: VideoCoreHostAPI) {
  hostApiInstance = api;
}

export function getWorkerClient(): { client: VideoCoreWorkerAPI; worker: Worker } {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('../../workers/video-core.worker.ts', import.meta.url), {
      type: 'module',
      name: 'video-core',
    });

    workerInstance.addEventListener('message', async (e) => {
      const data = e.data;
      if (!data || !data.type) return;

      if (data.type === 'rpc-response') {
        const pending = pendingCalls.get(data.id);
        if (pending) {
          if (data.error) pending.reject(new Error(data.error));
          else pending.resolve(data.result);
          pendingCalls.delete(data.id);
        }
      } else if (data.type === 'rpc-call') {
        try {
          if (!hostApiInstance) throw new Error('Host API not set');
          const method = data.method as keyof VideoCoreHostAPI;
          if (typeof hostApiInstance[method] !== 'function') {
            throw new Error(`Method ${data.method} not found on Host API`);
          }
          const result = await (hostApiInstance[method] as any)(...(data.args || []));
          workerInstance!.postMessage({ type: 'rpc-response', id: data.id, result });
        } catch (err: any) {
          workerInstance!.postMessage({ type: 'rpc-response', id: data.id, error: err.message });
        }
      }
    });
  }

  // Create a Proxy to easily call worker methods
  const clientAPI = new Proxy({}, {
    get(_, method: string) {
      if (method === 'initCompositor') {
        return async (canvas: OffscreenCanvas, width: number, height: number, bgColor: string) => {
          return new Promise<void>((resolve, reject) => {
            const id = ++callIdCounter;
            pendingCalls.set(id, { resolve, reject });
            workerInstance!.postMessage({
              type: 'rpc-call',
              id,
              method: 'initCompositor',
              args: [canvas, width, height, bgColor]
            }, [canvas]);
          });
        };
      }
      return async (...args: any[]) => {
        return new Promise((resolve, reject) => {
          const id = ++callIdCounter;
          pendingCalls.set(id, { resolve, reject });
          workerInstance!.postMessage({ type: 'rpc-call', id, method, args });
        });
      };
    }
  }) as VideoCoreWorkerAPI;

  return {
    client: clientAPI,
    worker: workerInstance,
  };
}
