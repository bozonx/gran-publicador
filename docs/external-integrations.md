# Интеграция внешних приложений (External API)

Gran Publicador предоставляет REST API для интеграции внешних приложений (например, видеоредакторов, инструментов автоматизации и т.д.). Этот API позволяет получить доступ к библиотеке контента пользователя, а также использовать сервисы распознавания речи (STT) и ИИ-ассистента (LLM).

## Способы аутентификации

### 1. Connect Flow (Рекомендуется для интерактивных приложений)

Позволяет пользователю авторизовать ваше приложение без ручного копирования токенов.

1.  Перенаправьте пользователя на страницу подключения:
    `GET /integrations/connect?name=ВашеНазвание&redirect_uri=https://your-app.com/callback`
2.  Пользователь нажимает "Разрешить".
3.  Система перенаправляет пользователя обратно на ваш `redirect_uri` с токеном в параметре URL:
    `https://your-app.com/callback?token=gp_token_...`
4.  Используйте этот токен в заголовке `Authorization: Bearer gp_token_...` для всех последующих запросов.

### 2. Ручные API токены (Для автоматизаций и скриптов)

Пользователь может создать токен вручную в настройках профиля Gran Publicador и передать его в ваше приложение. Аутентификация выполняется так же через заголовок `Authorization: Bearer <token>`.

---

## Virtual File System (VFS)

VFS позволяет работать с библиотекой контента Gran Publicador как с файловой структурой.

### Получение списка (List)
Отображает коллекции (папки) или элементы коллекции.

`GET /api/v1/external/vfs/list?path=/`

**Пример ответа (Root):**
```json
{
  "type": "directory",
  "items": [
    { "id": "uuid-1", "name": "Мои видео", "type": "directory", "path": "/uuid-1" }
  ]
}
```

### Поиск (Search)
Поиск элементов по названию, тексту или тегам.

`GET /api/v1/external/vfs/search?query=новость&tags=важное,видео`

**Пример ответа:**
```json
[
  {
    "id": "item-uuid",
    "name": "Заголовок новости",
    "type": "file",
    "media": [
      { "id": "media-uuid", "type": "VIDEO", "url": "/api/v1/media/media-uuid/file", "mimeType": "video/mp4" }
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
