# STT Audit Report

**Date**: 2025-02-12

## Summary

Full audit of Speech-To-Text (STT) functionality across three usage points: TiptapEditor, LlmGeneratorModal (AI chat), and Telegram bot. Multiple critical bugs found and fixed.

## Fixed Issues

### 1. LlmGeneratorModal — Audio never streamed via WebSocket (CRITICAL)

**Root cause**: The component called `useStt()` **twice** (creating two independent composable instances with separate sockets and state) and also called `useVoiceRecorder()` **separately**. The separate `useVoiceRecorder()` had no `onDataAvailable` callback wired to the WebSocket, so audio chunks were recorded but never sent to the server. The `transcribeAudio()` from the first `useStt()` instance received an empty blob. The `cancel` from the second `useStt()` instance operated on a different socket than the first.

**Fix**: Replaced with a single `useStt()` instance using `start`/`stop`/`cancel` methods that properly handle WebSocket streaming.

**Files**: `ui/app/components/modals/LlmGeneratorModal.vue`

### 2. TiptapEditor — Recording continues after connection error

**Root cause**: The `sttError` watcher showed a toast notification but didn't clear `sttSelection`, leaving the editor in an inconsistent state. The `useStt` composable's `stopAllActivityOnError` does stop recording internally, but the local `sttSelection` ref was never cleared.

**Fix**: Added `sttSelection.value = null` in the error watcher for both `sttError` and `recorderError`.

**Files**: `ui/app/components/editor/TiptapEditor.vue`

### 3. useStt composable — Socket event listener leaks

**Root cause**: 
- `detachSocketListeners()` removed `transcription-error` and `disconnect` handlers but **not** the `error` handler, causing listener accumulation.
- `waitForTranscription()` added its own `transcription-error` and `disconnect` handlers but the `cleanup()` function only removed the `transcription-result` handler, leaving the others dangling.

**Fix**: Added `socket.off('error', handleSocketError)` to `detachSocketListeners`. Updated `waitForTranscription` cleanup to remove all three of its locally registered handlers.

**Files**: `ui/app/composables/useStt.ts`

### 4. useStt composable — Broken socket persists in store

**Root cause**: When `ensureConnected()` failed (connection timeout/error), the socket remained in the Pinia store in a broken state. Next call to `store.connect()` returned the same broken socket since it checks `if (socket.value) return socket.value`.

**Fix**: On connection failure, `ensureConnected` now calls `detachSocketListeners()`, `sttStore.disconnect()`, and sets `socket = null`.

**Files**: `ui/app/composables/useStt.ts`

### 5. Telegram Bot — Voice transcription language always undefined

**Root cause**: `createContentItemFromMessage` and `addMediaGroupMessageToContentBlock` both called `transcribeVoice(ctx, fileId, undefined)` with hardcoded `undefined` for language. The user's content language (`user.language`) was available in `processMessage` but never passed down.

**Fix**: Added `language?: string` to both method option interfaces and passed `user.language` from `processMessage`.

**Files**: `src/modules/telegram-bot/telegram-bot.update.ts`

## Issues Requiring User Attention

### 1. STT Service Availability

The STT functionality depends on an external `stt-gateway-microservice`. If this service is not running or not configured (`STT_SERVICE_URL` env var), all STT features will fail gracefully with error messages, but the user experience will be poor. Ensure the STT microservice is deployed and accessible.

### 2. Pre-existing TypeScript Lint Error (unrelated)

`TiptapEditor.vue:162` — `transformPastedText` does not exist in type `Partial<MarkdownExtensionOptions>`. This is a pre-existing issue with the `@tiptap/markdown` extension type definitions, not related to STT changes.

### 3. Pre-existing Nuxt Type Errors (unrelated)

Several pre-existing type errors in `notifications.ts`, `users.ts`, `archive.types.ts`, `roles.types.ts` — all unrelated to STT.

## Architecture Notes

- **Backend**: `SttService` proxies audio to an external STT Gateway microservice via HTTP. `SttGateway` is a WebSocket gateway (`/stt` namespace) that streams audio chunks from the browser to `SttService`.
- **UI Editor (TiptapEditor)**: Uses `useStt()` composable which internally creates a `useVoiceRecorder()` with `onDataAvailable` callback wired to the WebSocket. Audio is streamed in real-time.
- **UI AI Chat (LlmGeneratorModal)**: Now uses the same `useStt()` composable with streaming (was broken before this fix).
- **Telegram Bot**: Downloads voice files from Telegram API and sends them as a stream to `SttService.transcribeAudioStream()`.
