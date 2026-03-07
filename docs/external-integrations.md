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

**Параметры:**
* `path`: Путь (например, `/`, `/uuid-folder`, `/virtual-all`)
* `limit`: Количество элементов (по умолчанию 50)
* `offset`: Смещение

**Пример ответа (Root):**
В корне всегда присутствует виртуальная папка `All` (`virtual-all`), содержащая все элементы без папок (orphans).
```json
{
  "type": "directory",
  "items": [
    { 
      "id": "virtual-all", 
      "name": "All", 
      "type": "directory", 
      "path": "/virtual-all",
      "itemsCount": 42
    },
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

### Управление коллекциями (Folders)

#### Создание папки
`POST /api/v1/external/vfs/collections`
* **Body:** `{ "name": "Новая папка", "parentId": "optional-uuid" }`

#### Переименование папки
`PATCH /api/v1/external/vfs/collections/:id`
* **Body:** `{ "name": "Новое название" }`

#### Удаление папки
`DELETE /api/v1/external/vfs/collections/:id`
*Внимание: При удалении папки в Gran Publicador, вложенные элементы не удаляются, а перемещаются уровнем выше или становятся "сиротами" (появляются в папке All).*

---

### Управление файлами (Items)

#### Загрузка файла (Upload)
Загрузка файла напрямую в указанную коллекцию.

`POST /api/v1/external/vfs/upload`
*   **Body:** `multipart/form-data`
*   **Fields:**
    *   `file`: (binary) Файл
    *   `collectionId`: (string) ID коллекции или `virtual-all`
    *   `projectId`: (string, optional) ID проекта (если токен имеет доступ к нескольким проектам)

#### Обновление файла (Rename/Tags)
`PATCH /api/v1/external/vfs/items/:id`
* **Body:** `{ "name": "Новое имя.mp4", "tags": ["важное", "ready"] }`

#### Удаление файла (Delete)
`DELETE /api/v1/external/vfs/items/:id`
*Полное удаление контента и связанных медиа-файлов.*

---

### Поиск (Search)
Поиск элементов по названию, тексту или тегам с фильтрацией по типу.

`GET /api/v1/external/vfs/search?query=новость&tags=важное,видео&type=video`

**Доступные типы (`type`):** `video`, `audio`, `image`, `text`, `document`.

---

## Сервисы (Proxy)

### Speech-to-Text (STT)
Преобразование аудио в текст.

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
