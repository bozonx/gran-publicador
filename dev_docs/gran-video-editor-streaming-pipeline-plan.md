# Gran Video Editor: Worker + Streaming Export Pipeline Plan

## Цель

Сделать экспорт устойчивым для длинных таймлайнов и минимизировать блокировки main thread:

- декод/композит/кодек выполняются в Worker;
- запись результата идет потоково (chunk-by-chunk) без накопления большого буфера в памяти;
- UI получает прогресс и может отменить экспорт.

## Предлагаемая архитектура

```text
Main Thread
  ├─ TimelineExportModal
  ├─ ExportWorkerClient (RPC over postMessage)
  └─ FileSystem WritableStream (from File Handle)

Dedicated Worker (export.worker.ts)
  ├─ Timeline preparation (sanitize timeline + source ranges)
  ├─ VideoCompositorWorker (OffscreenCanvas + Pixi/2D)
  ├─ WebCodecs encode loop (video/audio)
  ├─ Mediabunny Output + StreamTarget
  └─ Progress / Error / Complete events
```

## Контракт сообщений

### Main -> Worker

- `init_export`
  - `timeline`: сериализованный snapshot (только нужные поля)
  - `settings`: width/height/fps/codec/bitrate/audio
  - `writablePort`: `WritableStream` sink (через transfer)
- `cancel_export`

### Worker -> Main

- `progress`
  - `phase`: `decode | compose | encode | finalize`
  - `percent`: `0..100`
  - `frame`: current/total
- `error`
  - `message`
  - `recoverable: boolean`
- `completed`
  - `durationMs`
  - `frames`

## Потоковая запись

1. Main thread открывает `FileSystemFileHandle.createWritable()`.
2. Передает writable в worker (или MessagePort-прокси, если браузер не поддерживает direct transfer).
3. Worker создает `StreamTarget(writable, { chunked: true, chunkSize: 16 * 1024 * 1024 })`.
4. `Output.start()` -> frame loop -> `Output.finalize()`.
5. Writable закрывается автоматически на finalize.

## Отмена

- Main thread отправляет `cancel_export`.
- Worker ставит `isCancelled = true`.
- В frame loop и audio loop делается ранний выход.
- Вызываются `videoEncoder.flush()` / `audioEncoder.flush()` по возможности, затем безопасный teardown.
- Worker отправляет `error` с признаком `recoverable: true` и текстом `Export cancelled by user`.

## Надежность

- Валидация входного snapshot перед началом.
- Ограничение параметров экспорта (fps/bitrate/dimensions) в worker.
- Таймаут на decode sample (guard для зависших источников).
- Backpressure контроль (`encodeQueueSize` + периодический `flush`).
- Cleanup в `finally`: dispose input/sink/frame/audioData/output.

## Этапы внедрения

1. **M1: Worker infrastructure**
   - добавить `export.worker.ts`, `ExportWorkerClient`;
   - перенести encode loop в worker без изменения UI API.
2. **M2: Streaming sink integration**
   - передача writable в worker и `StreamTarget(chunked)`.
3. **M3: Audio pipeline hardening**
   - перейти от полного `decodeAudioData(fileArrayBuffer)` к chunk/track-based пути;
   - учесть `sourceRange` в аудио так же, как в видео.
4. **M4: Cancellation and retries**
   - кнопка Cancel в UI, повторный запуск без перезагрузки страницы.
5. **M5: Telemetry**
   - метрики phase duration, encode FPS, dropped frames.

## Критерии готовности

- UI остается отзывчивым во время экспорта.
- Нет роста памяти пропорционально длительности экспорта.
- Экспорт корректно отменяется и не оставляет «подвешенных» ресурсов.
- Видео и аудио соблюдают `timelineRange` + `sourceRange`.
