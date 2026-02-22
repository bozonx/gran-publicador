import type { VideoCoreWorkerAPI } from './worker-rpc';

export interface VideoCoreHostAPI {
  getFileHandleByPath(path: string): Promise<FileSystemFileHandle | null>;
  onExportProgress(progress: number): void;
}

let workerInstance: Worker | null = null;
let hostApiInstance: VideoCoreHostAPI | null = null;

let callIdCounter = 0;
const pendingCalls = new Map<number, { resolve: Function; reject: Function }>();

function rejectAllPendingCalls(error: Error) {
  for (const [id, pending] of pendingCalls.entries()) {
    try {
      pending.reject(error);
    } finally {
      pendingCalls.delete(id);
    }
  }
}

function terminateCurrentWorker(reason: string) {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
  rejectAllPendingCalls(new Error(reason));
}

function createWorker(): Worker {
  const worker = new Worker(new URL('../../workers/video-core.worker.ts', import.meta.url), {
    type: 'module',
    name: 'video-core',
  });

  worker.addEventListener('message', async e => {
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
        worker.postMessage({ type: 'rpc-response', id: data.id, result });
      } catch (err: any) {
        worker.postMessage({ type: 'rpc-response', id: data.id, error: err.message });
      }
    }
  });

  worker.addEventListener('error', event => {
    console.error('[WorkerClient] Worker error', event);
    if (workerInstance === worker) {
      terminateCurrentWorker('Worker crashed. Please retry the operation.');
    }
  });

  worker.addEventListener('messageerror', event => {
    console.error('[WorkerClient] Worker message error', event);
    if (workerInstance === worker) {
      terminateCurrentWorker('Worker message channel failed. Please retry the operation.');
    }
  });

  return worker;
}

function ensureWorker(): Worker {
  if (!workerInstance) {
    workerInstance = createWorker();
  }
  return workerInstance;
}

export function setHostApi(api: VideoCoreHostAPI) {
  hostApiInstance = api;
}

export function terminateWorker(reason = 'Worker terminated') {
  terminateCurrentWorker(reason);
}

export function restartWorker() {
  terminateCurrentWorker('Worker restarted');
  return getWorkerClient();
}

export function getWorkerClient(): { client: VideoCoreWorkerAPI; worker: Worker } {
  const worker = ensureWorker();

  // Create a Proxy to easily call worker methods
  const clientAPI = new Proxy(
    {},
    {
      get(_, method: string) {
        if (method === 'initCompositor') {
          return async (
            canvas: OffscreenCanvas,
            width: number,
            height: number,
            bgColor: string,
          ) => {
            return new Promise<void>((resolve, reject) => {
              const id = ++callIdCounter;
              pendingCalls.set(id, { resolve, reject });
              ensureWorker().postMessage(
                {
                  type: 'rpc-call',
                  id,
                  method: 'initCompositor',
                  args: [canvas, width, height, bgColor],
                },
                [canvas],
              );
            });
          };
        }
        return async (...args: any[]) => {
          return new Promise((resolve, reject) => {
            const id = ++callIdCounter;
            pendingCalls.set(id, { resolve, reject });
            ensureWorker().postMessage({ type: 'rpc-call', id, method, args });
          });
        };
      },
    },
  ) as VideoCoreWorkerAPI;

  return {
    client: clientAPI,
    worker,
  };
}
