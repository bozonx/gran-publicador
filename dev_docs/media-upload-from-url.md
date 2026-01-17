# Media Storage Integration - Upload from URL

## Изменения

### 1. Исправлен тест для checkMediaAccess
**Файл:** `test/unit/media.service.spec.ts`

Исправлен порядок параметров в вызове `checkProjectAccess` в тесте:
```typescript
// Было (неправильно):
expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith('user-1', 'project-1');

// Стало (правильно):
expect(mockPermissionsService.checkProjectAccess).toHaveBeenCalledWith('project-1', 'user-1');
```

Это соответствует сигнатуре метода: `checkProjectAccess(projectId: string, userId: string)`

### 2. Реализована загрузка файлов по URL

#### MediaService
**Файл:** `src/modules/media/media.service.ts`

Добавлен новый метод `uploadFileFromUrl`:
```typescript
async uploadFileFromUrl(
  url: string,
  filename?: string,
): Promise<{ fileId: string; metadata: Record<string, any> }>
```

Метод:
- Отправляет POST запрос к `${mediaStorageUrl}/files/from-url`
- Передает URL и опциональное имя файла
- Поддерживает настройки компрессии из конфигурации
- Обрабатывает таймауты и ошибки
- Возвращает fileId и метаданные файла

#### MediaController
**Файл:** `src/modules/media/media.controller.ts`

Обновлен эндпоинт `POST /media/upload-from-url`:
- Убран TODO и заглушка
- Реализована полная функциональность:
  - Загрузка файла через Media Storage
  - Определение типа медиа по MIME-типу
  - Извлечение имени файла из URL (если не указано)
  - Создание записи в БД

Добавлен вспомогательный метод `extractFilenameFromUrl` для извлечения имени файла из URL.

#### Тесты
**Файл:** `test/unit/media.service.spec.ts`

Добавлены тесты для `uploadFileFromUrl`:
- ✅ Успешная загрузка с указанием имени файла
- ✅ Успешная загрузка без указания имени файла
- ✅ Обработка ошибок от Media Storage
- ✅ Обработка таймаутов

## Использование

### Пример запроса

```bash
curl -X POST http://localhost:8080/media/upload-from-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/image.jpg",
    "filename": "my-image.jpg"
  }'
```

### Пример ответа

```json
{
  "id": "uuid-media-id",
  "type": "IMAGE",
  "storageType": "FS",
  "storagePath": "storage-file-id-123",
  "filename": "my-image.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400,
  "meta": {
    "originalSize": 102400,
    "size": 81920,
    "mimeType": "image/jpeg",
    "checksum": "sha256-hash",
    "url": "http://storage/files/storage-file-id-123"
  },
  "createdAt": "2026-01-17T17:40:00.000Z",
  "updatedAt": "2026-01-17T17:40:00.000Z"
}
```

## Статус тестов

✅ Все новые тесты проходят успешно
✅ Исправленный тест `checkMediaAccess` проходит
⚠️ Один старый тест `streamFileFromStorage` падает (не связан с текущими изменениями)

## Соответствие документации Media Storage

| Функция | Статус |
|---------|--------|
| `POST /files` | ✅ Реализовано |
| `POST /files/from-url` | ✅ **Реализовано в этом PR** |
| `GET /files/:id/download` | ✅ Реализовано |
| `GET /files/:id/thumbnail` | ✅ Реализовано |
| `DELETE /files/:id` | ✅ Реализовано |
