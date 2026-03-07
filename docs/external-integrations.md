# Интеграция внешних приложений (External API)

Gran Publicador предоставляет REST API для интеграции внешних приложений (например, видеоредакторов, инструментов автоматизации и т.д.). Этот API позволяет получить доступ к библиотеке контента пользователя, а также использовать сервисы распознавания речи (STT) и ИИ-ассистента (LLM).

## Способы аутентификации

### 1. Connect Flow (Рекомендуется для интерактивных приложений)

Позволяет пользователю авторизовать ваше приложение без ручного копирования токенов.

1.  Перенаправьте пользователя на страницу подключения:
    `GET /integrations/connect?name=ВашеНазвание&redirect_uri=https://your-app.com/callback&scopes=vfs:read,stt:transcribe`
2.  Вы можете указать нужные вам разрешения через параметр `scopes` (через запятую).
3.  Пользователь нажимает "Разрешить".
4.  Система перенаправляет пользователя обратно на ваш `redirect_uri` с токеном в параметре URL:
    `https://your-app.com/callback?token=gp_token_...`
5.  Используйте этот токен в заголовке `Authorization: Bearer gp_token_...` для всех последующих запросов.

### 2. Ручные API токены (Для автоматизаций и скриптов)

Пользователь может создать токен вручную в настройках профиля Gran Publicador и выбрать необходимые API Scopes. Аутентификация выполняется так же через заголовок `Authorization: Bearer <token>`.

## Доступные Scopes (Разрешения)

| Scope | Описание |
| :--- | :--- |
| `vfs:read` | Чтение и поиск в библиотеке контента |
| `vfs:write` | Управление файлами (загрузка, удаление, переименование, создание папок) |
| `stt:transcribe` | Доступ к распознаванию речи (STT) |
| `llm:chat` | Доступ к ИИ-ассистенту (LLM) |

---

## Проверка состояния (Health Check)

Вы можете проверить валидность токена и получить информацию о его владельце и разрешениях.

`GET /api/v1/external/health`

---

## Virtual File System (VFS)

VFS позволяет работать с библиотекой контента Gran Publicador как с файловой структурой.

### Получение списка (List)
Отображает коллекции (папки), подпапки и элементы коллекции.

`GET /api/v1/external/vfs/list?path=/`

**Пример ответа (Файлы):**
Для каждого медиа-файла возвращаются `url` и `thumbnailUrl`. Эти ссылки уже **подписаны** и не требуют передачи токена авторизации.
```json
{
  "id": "item-uuid",
  "name": "Интервью",
  "type": "file",
  "media": [
    {
      "id": "media-uuid",
      "type": "VIDEO",
      "url": "/api/v1/media/p/media-uuid/SIGNATURE?download=1",
      "thumbnailUrl": "/api/v1/media/p/media-uuid/SIGNATURE/thumbnail?w=400&h=400",
      "mimeType": "video/mp4"
    }
  ]
}
```

### Управление коллекциями (Folders)

#### Создание папки
`POST /api/v1/external/vfs/collections`
* **Body:** `{ "name": "Новая папка", "parentId": "optional-uuid" }`

#### Переименование папки
`PATCH /api/v1/external/vfs/collections/:id`
* **Body:** `{ "name": "Новое название" }`

#### Удаление папки
`DELETE /api/v1/external/vfs/collections/:id`

---

### Управление файлами (Items)

#### Загрузка файла (Upload)
Загрузка файла напрямую в указанную коллекцию.
`POST /api/v1/external/vfs/upload` (Multipart form-data)

#### Обновление файла (Rename/Tags)
`PATCH /api/v1/external/vfs/items/:id`
* **Body:** `{ "name": "Новое имя.mp4", "tags": ["важное"] }`

#### Удаление файла (Delete)
`DELETE /api/v1/external/vfs/items/:id`

#### Безопасный доступ к медиа (Signed URLs)
Поля `url` и `thumbnailUrl` в VFS ответах уже содержат `publicToken`. Это позволяет:
* Вставлять превью напрямую в `<img>` и `<video>`.
* Передавать ссылки во внешние плееры/редакторы без риска компрометации основного API-ключа.
* Стримить видео по прямым ссылкам.

---

### Поиск (Search)
Поиск элементов по названию, тексту или тегам с фильтрацией по типу.

`GET /api/v1/external/vfs/search?query=новость`

---

## Сервисы (Proxy)

### Speech-to-Text (STT)

#### 1. Transcribe from URL
**Endpoint:** `POST /api/v1/external/api/v1/transcribe`

**Description:** Transcribes audio from a public URL.

**Request Body:**
```json
{
  "fileUrl": "https://example.com/audio.mp3",
  "language": "en",
  "provider": "assemblyai",
  "restorePunctuation": true,
  "formatText": true
}
```

#### 2. Transcribe Audio Stream
**Endpoint:** `POST /api/v1/external/api/v1/transcribe/stream`

**Description:** Transcribes audio by uploading the raw audio bytes directly as a stream. The service forwards the uploaded bytes to `tmp-files-microservice`, obtains a temporary public URL, and then proceeds with transcription.

**Request Headers:**
- `Content-Type: audio/*`
- `X-File-Name: audio.mp3` (optional)
- `X-STT-Provider: assemblyai` (optional)
- `X-STT-Language: en` (optional)
- `X-STT-Restore-Punctuation: true|false` (optional)
- `X-STT-Format-Text: true|false` (optional)
- `X-STT-Models: universal-3-pro,universal-2` (optional)
- `X-STT-Api-Key: ...` (optional)

**Body:** Raw audio bytes

### AI Assistant (LLM)
`POST /api/v1/external/llm/chat`

---

## Базовый URL
Все запросы должны идти на: `https://your-gran-instance.com/api/v1/`
Обязательный заголовок для API методов: `Authorization: Bearer <your_token>`
