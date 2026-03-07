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
| `vfs:write` | Загрузка новых файлов в библиотеку |
| `stt:transcribe` | Доступ к распознаванию речи (STT) |
| `llm:chat` | Доступ к ИИ-ассистенту (LLM) |

---

## Проверка состояния (Health Check)

Вы можете проверить валидность токена и получить информацию о его владельце и разрешениях.

`GET /api/v1/external/health`

**Пример ответа:**
```json
{
  "status": "ok",
  "timestamp": "2024-03-07T12:00:00.000Z",
  "user": { "id": "user-uuid" },
  "token": {
    "id": "token-uuid",
    "name": "My App",
    "scopes": ["vfs:read", "stt:transcribe"],
    "allProjects": true,
    "projectIds": []
  }
}
```

---

## Virtual File System (VFS)

VFS позволяет работать с библиотекой контента Gran Publicador как с файловой структурой.

### Получение списка (List)
Отображает коллекции (папки), подпапки и элементы коллекции.

`GET /api/v1/external/vfs/list?path=/`

**Пример ответа (Root):**
```json
{
  "type": "directory",
  "items": [
    { 
      "id": "uuid-1", 
      "name": "Мои видео", 
      "type": "directory", 
      "path": "/uuid-1",
      "itemsCount": 15
    }
  ]
}
```

**Пример ответа (Папка с контентом и подпапками):**
```json
{
  "type": "directory",
  "items": [
    { 
      "id": "sub-uuid-1", 
      "name": "Архив", 
      "type": "directory", 
      "path": "/sub-uuid-1",
      "itemsCount": 5
    },
    {
      "id": "item-uuid",
      "name": "Интервью",
      "type": "file",
      "path": "/uuid-1/item-uuid",
      "text": "Полный текст транскрибации...",
      "tags": ["важное", "интервью"],
      "language": "ru-RU",
      "meta": {},
      "media": [
        { 
          "id": "media-uuid", 
          "type": "VIDEO", 
          "url": "/api/v1/media/media-uuid/file?download=1", 
          "mimeType": "video/mp4",
          "size": 10485760,
          "meta": { "width": 1920, "height": 1080 }
        }
      ]
    }
  ]
}
```

### Поиск (Search)
Поиск элементов по названию, тексту или тегам с фильтрацией по типу.

`GET /api/v1/external/vfs/search?query=новость&tags=важное,видео&type=video`

**Доступные типы (`type`):** `video`, `audio`, `image`, `text`, `document`.

**Пример ответа:**
```json
[
  {
    "id": "item-uuid",
    "name": "Заголовок новости",
    "type": "file",
    "text": "Текст новости...",
    "tags": ["важное"],
    "language": "ru-RU",
    "meta": {},
    "media": [
      { 
        "id": "media-uuid", 
        "type": "VIDEO", 
        "url": "/api/v1/media/media-uuid/file?download=1", 
        "mimeType": "video/mp4",
        "meta": { "duration": 120 }
      }
    ]
  }
]
```

### Загрузка контента (Upload)
Загрузка файла напрямую в указанную коллекцию.

`POST /api/v1/external/vfs/upload`
*   **Body:** `multipart/form-data`
*   **Fields:**
    *   `file`: (binary) Файл
    *   `collectionId`: (string) ID коллекции
    *   `projectId`: (string, optional) ID проекта

---

## Сервисы (Proxy)

### Speech-to-Text (STT)
Преобразование аудио в текст с использованием лимитов пользователя.

`POST /api/v1/external/stt/transcribe`
*   **Body:** `multipart/form-data`
*   **Fields:**
    *   `file`: (binary) Аудиофайл
    *   `language`: (string, optional) Код языка (например, `ru`, `en`)

### AI Assistant (LLM)
Доступ к чату с ИИ-ассистентом.

`POST /api/v1/external/llm/chat`
*   **Body:** `application/json`
```json
{
  "messages": [
    { "role": "user", "content": "Напиши заголовок для видео о кошках" }
  ]
}
```

---

## Базовый URL
Все запросы должны идти на: `https://your-gran-instance.com/api/v1/`
Обязательный заголовок: `Authorization: Bearer <your_token>`
