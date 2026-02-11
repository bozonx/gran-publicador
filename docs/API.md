# API Reference — Gran Publicador

Настоящий документ содержит подробное описание всех эндпоинтов API системы Gran Publicador. 

Общие сведения об архитектуре, установке и принципе работы системы находятся в [README.md](../README.md).

## Содержание

- [Общая информация](#общая-информация)
- [Аутентификация](#аутентификация)
- [Auth API](#auth-api)
- [Projects API](#projects-api)
- [Channels API](#channels-api)
- [Publications API](#publications-api)
- [Content Library API](#content-library-api)
- [News Queries API](#news-queries-api)
- [LLM API](#llm-api)
- [System API (Schedulers)](#system-api-schedulers)
- [Health Check](#health-check)
- [Приложение: Enum значения](#приложение-enum-значения)

---

## Общая информация

### Base URL
- **Development**: `http://localhost:8080/api/v1`
- **Production**: `https://your-domain.com/api/v1`

### Формат данных
- **Content-Type**: `application/json`
- **Даты**: ISO 8601 (`2024-01-15T10:30:00.000Z`)

### Пагинация (Query параметры)
Большинство списочных эндпоинтов поддерживают следующие параметры пагинации:

| Параметр | Тип | По умолчанию | Описание |
| :--- | :--- | :--- | :--- |
| `limit` | number | 50 | Количество возвращаемых элементов (макс. 100) |
| `offset` | number | 0 | Смещение для пагинации |

---

## Аутентификация

Для доступа к API требуется передача токена в заголовках.

### 1. JWT Токен (для фронтенда)
Используется при авторизации через Telegram Mini App.
```http
Authorization: Bearer <JWT_TOKEN>
```

### 2. API Токен (для интеграций)
```http
x-api-key: gp_<TOKEN_VALUE>
```
*Также поддерживается заголовок `Authorization: Bearer gp_<TOKEN_VALUE>`.*

---

## Auth API

### POST `/auth/telegram`
Аутентификация через Telegram Mini App.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `initData` | string | Да | Данные инициализации от Telegram WebApp (`window.Telegram.WebApp.initData`) |

---

## Projects API

### GET `/projects`
Получение списка проектов текущего пользователя.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `search` | string | Поиск по названию или описанию |
| `includeArchived` | boolean | Включить архивные проекты |
| `limit` | number | Лимит (см. [Пагинация](#пагинация-query-параметры)) |

### POST `/projects`
Создание нового проекта.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `name` | string | Да | Название проекта (макс. 255 символов) |
| `description` | string | Нет | Описание проекта |

---

## Channels API

### GET `/channels`
Получение списка всех каналов, доступных пользователю.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `projectId` | UUID | Фильтр по конкретному проекту |
| `socialMedia` | Enum | Фильтр по соцсети (см. [SocialMedia](#socialmedia)) |
| `issueType` | Enum | Фильтр проблемных каналов |
| `search` | string | Поиск по названию или идентификатору |
| `isActive` | boolean | Фильтр по статусу активности |

### POST `/channels`
Создание нового канала в проекте.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `projectId` | UUID | Да | ID связанного проекта |
| `socialMedia` | Enum | Да | Тип соцсети (см. [SocialMedia](#socialmedia)) |
| `name` | string | Да | Название канала для системы |
| `channelIdentifier` | string | Да | ID в соцсети (@username, URL и т.д.) |
| `credentials` | object | Нет | JSON с токенами/ключами доступа |
| `isActive` | boolean | Нет | Активен ли канал (true по умолчанию) |

---

## Author Signatures API

Подписи авторов управляются на уровне проекта и поддерживают языковые вариации.

### GET `/projects/:projectId/author-signatures`
Получение всех подписей проекта. Владелец проекта и админы видят все подписи, остальные — только свои.

**Ответ**: массив `ProjectAuthorSignature` с вложенными `variants`.

### POST `/projects/:projectId/author-signatures`
Создание новой подписи с первым вариантом на языке текущего пользователя.

| Поле | Тип | Обязательное | Описание |
| :--- | :--- | :--- | :--- |
| `content` | string | Да | Содержимое первого языкового варианта |

### PATCH `/author-signatures/:id`
Обновление подписи (порядок сортировки). Требуется доступ (владелец подписи, владелец/админ проекта, системный админ).

| Поле | Тип | Обязательное | Описание |
| :--- | :--- | :--- | :--- |
| `order` | number | Нет | Порядок сортировки |

### DELETE `/author-signatures/:id`
Удаление подписи и всех её вариантов.

### PUT `/author-signatures/:id/variants/:language`
Создание или обновление языкового варианта подписи.

| Поле | Тип | Обязательное | Описание |
| :--- | :--- | :--- | :--- |
| `content` | string | Да | Содержимое варианта |

### DELETE `/author-signatures/:id/variants/:language`
Удаление языкового варианта подписи.

---

## Publications API

### GET `/publications`
Получение списка публикаций с расширенной фильтрацией.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `projectId` | UUID | Фильтр по проекту |
| `status` | Enum | Фильтр по [PublicationStatus](#publicationstatus) |
| `search` | string | Поиск по заголовку и тексту |
| `language` | string | Фильтр по языку (напр., `ru-RU`) |
| `ownership` | Enum | `OWN` (мои), `NOT_OWN` (чужие) |
| `issueType` | Enum | `FAILED`, `PARTIAL`, `EXPIRED` |
| `sortBy` | Enum | `createdAt`, `title`, `status`, `chronology`, `byScheduled` |
| `sortOrder` | string | `asc` или `desc` |

### POST `/publications`
Создание новой публикации.

**Параметры Body (основные):**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `projectId` | UUID | Нет | ID проекта (если не указан — личный черновик) |
| `title` | string | Нет | Заголовок (макс. 255) |
| `content` | string | Условно* | Текст публикации (обязателен, если нет медиа) |
| `language` | string | Да | Код языка (напр., `ru-RU`) |
| `status` | Enum | Нет | Статус (`DRAFT`, `READY`) |
| `media` | array | Нет | Массив объектов новых медиафайлов |
| `existingMediaIds` | array | Нет | Массив ID уже загруженных медиа |

### POST `/publications/:id/llm/chat`

Чат с LLM по конкретной публикации.

Особенности:
1. История чата и использованный контекст хранятся **на сервере** в `publication.meta.llmPublicationContentGenerationChat`.
2. Контекст (`content`, `mediaDescriptions`, `contextLimitChars`) передаётся **только в первом сообщении**. Для последующих сообщений контекст не отправляется — сервер использует сохранённую историю.
3. System message добавляется сервером в самое начало и пользователю не показывается.

**Параметры Path:**

| Параметр | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `id` | UUID | Да | ID публикации |

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `message` | string | Да | Сообщение пользователя |
| `context` | object | Нет | Контекст (отправляется только в первом сообщении) |
| `context.content` | string | Нет | Контент публикации |
| `context.mediaDescriptions` | string[] | Нет | Описания изображений |
| `context.contextLimitChars` | number | Нет | Лимит символов для контекста |
| `temperature` | number | Нет | Параметр «креативности» модели |
| `max_tokens` | number | Нет | Лимит токенов ответа |
| `model` | string | Нет | Явно указать модель |
| `tags` | string[] | Нет | Теги для маршрутизации/фильтрации моделей |
| `onlyRawResult` | boolean | Нет | Добавить system prompt для возврата «сырого» результата |

**Ответ:**

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `message` | string | Ответ ассистента |
| `metadata` | object | Метаданные маршрутизации LLM Router |
| `usage` | object | Метрики использования токенов |
| `chat` | object | Сохранённое состояние чата (сообщения, контекст, метаданные) |

---

## Content Library API

Библиотека контента поддерживает два скоупа:

- `personal` — личная библиотека пользователя
- `project` — библиотека проекта (доступна участникам проекта)

### GET `/content-library/items`

Получить список элементов библиотеки.

**Query параметры:**

| Параметр | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `scope` | string | Да | `personal` или `project` |
| `projectId` | UUID | Нет* | Обязателен при `scope=project` |
| `search` | string | Нет | Поиск по `title`, `note`, `tags`, `blocks.text` |
| `limit` | number | Нет | Лимит (см. [Пагинация](#пагинация-query-параметры)) |
| `offset` | number | Нет | Смещение (см. [Пагинация](#пагинация-query-параметры)) |
| `includeArchived` | boolean | Нет | Включить архивные вместе с активными |
| `archivedOnly` | boolean | Нет | Вернуть только архивные |
| `includeBlocks` | boolean | Нет | Включить `blocks` в ответ (по умолчанию `true`). Для ускорения списков можно передать `false` |

### POST `/content-library/items`

Создать новый элемент библиотеки.

**Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `scope` | string | Да | `personal` или `project` |
| `projectId` | UUID | Нет* | Обязателен при `scope=project` |
| `title` | string | Нет | Заголовок |
| `tags` | string[] | Нет | Массив тегов |
| `note` | string | Нет | Заметка |
| `blocks` | array | Нет | Список блоков контента |

Примечание: пустые элементы/блоки допустимы (создаются UI сразу при нажатии "создать").

### PATCH `/content-library/items/:id`

Обновить `title/tags/note/meta` элемента.

### POST `/content-library/items/:id/archive`

Архивировать элемент (поместить в корзину).

### POST `/content-library/items/:id/restore`

Восстановить элемент из корзины.

### POST `/content-library/projects/:projectId/purge-archived`

Очистить корзину проекта: удалить **все** архивные элементы проекта.

**Ограничение:** только владелец проекта.

### DELETE `/content-library/items/:id`

Удалить элемент навсегда.

---

## News Queries API

Управление запросами на автоматический сбор новостей (News Hunter).

### GET `/projects/:projectId/news-queries`
Список поисковых запросов проекта.

### POST `/projects/:projectId/news-queries`
Создание нового запроса.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `name` | string | Да | Название запроса |
| `query` | string | Да | Ключевые слова для поиска |
| `sources` | string[] | Нет | Список конкретных доменов/источников |
| `isActive` | boolean | Нет | Включение сбора по расписанию |

---

## LLM API

Эндпоинты для генерации и извлечения данных через LLM. Для доступа требуется аутентификация.

### POST `/llm/generate`

Генерация текста на основе `prompt` и дополнительного контекста.

Важно: сборка финального запроса для LLM выполняется **на сервере**. Клиент передаёт `prompt` и структурированные источники контекста.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `prompt` | string | Да | Инструкция/запрос пользователя |
| `selectionText` | string | Нет | Выделенный фрагмент в редакторе (используется как контекст с приоритетом над `content`) |
| `content` | string | Нет | Полный текст/блок публикации (контекст) |
| `useContent` | boolean | Нет | Использовать ли `content` как контекст (обычно `true`, если генерация по всему контенту, и `false`, если `selectionText` задан) |
| `mediaDescriptions` | string[] | Нет | Список текстовых описаний изображений |
| `contextLimitChars` | number | Нет | Ограничение на количество символов, добавляемых из контекста |
| `onlyRawResult` | boolean | Нет | Если `true`, сервер добавит system prompt для возврата «сырого» результата без дополнительного форматирования |
| `temperature` | number | Нет | Параметр «креативности» модели |
| `max_tokens` | number | Нет | Лимит токенов ответа |
| `model` | string | Нет | Явно указать модель |
| `tags` | string[] | Нет | Теги для маршрутизации/фильтрации моделей |

**Ответ:**

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `content` | string | Сгенерированный текст |
| `metadata` | object | Метаданные маршрутизации LLM Router |
| `usage` | object | Метрики использования токенов |

### POST `/llm/generate-publication-fields`

Генерация полей публикации и постов по каналам на основе исходного текста.

**Параметры Body (основные):**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `prompt` | string | Да | Исходный текст для генерации |
| `publicationLanguage` | string | Да | Язык публикации (например, `ru-RU`) |
| `channels` | array | Да | Список каналов с настройками генерации |

---

## System API (Schedulers)

Принудительный запуск фоновых задач. Требует `X-System-Token`.

### POST `/system/schedulers/publications/trigger`
Запуск планировщика публикаций (обработка очереди постов).

### POST `/system/schedulers/news/trigger`
Запуск планировщика новостей (сбор и уведомления).

---

## Health Check

### GET `/health`
Проверка состояния сервиса. Возвращает `200 OK`, если система работает.

---

## Приложение: Enum значения

### ProjectRole
- `OWNER`, `ADMIN`, `EDITOR`, `VIEWER`

### SocialMedia
- `TELEGRAM`, `VK`, `YOUTUBE`, `TIKTOK`, `FACEBOOK`, `SITE`, `X`, `INSTAGRAM`, `LINKEDIN`

### PublicationStatus
- `DRAFT` — Черновик
- `READY` — Готов
- `SCHEDULED` — Запланирован
- `PROCESSING` — Публикуется
- `PUBLISHED` — Опубликован
- `PARTIAL` — Частично опубликован
- `FAILED` — Ошибка
- `EXPIRED` — Просрочен

### PostType
- `POST`, `ARTICLE`, `NEWS`, `VIDEO`, `SHORT`, `STORY`

#### Запрос

```
GET /api/v1/posts?channelId=990e8400-e29b-41d4-a716-446655440004&status=SCHEDULED
```

**Query параметры:**
- `channelId` (string, optional) - фильтр по каналу
- `publicationId` (string, optional) - фильтр по публикации
- `status` (PostStatus, optional) - фильтр по статусу
- `limit` (number, optional) - количество (по умолчанию: 50)
- `offset` (number, optional) - смещение (по умолчанию: 0)

#### Ответ

```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "publicationId": "aa0e8400-e29b-41d4-a716-446655440005",
    "channelId": "990e8400-e29b-41d4-a716-446655440004",
    "authorId": "660e8400-e29b-41d4-a716-446655440001",
    "content": "Текст поста...",
    "socialMedia": "TELEGRAM",
    "postType": "POST",
    "title": "Заголовок",
    "description": "Описание",
    "authorComment": "Комментарий автора (публикуется после текста новости)",
    "tags": "технологии,AI",
    "media": [
      {
        "id": "cc0e8400-e29b-41d4-a716-446655440007",
        "order": 0,
        "media": {
          "id": "dd0e8400-e29b-41d4-a716-444455440008",
          "storageType": "FS",
          "storagePath": "uploads/image.jpg"
        }
      }
    ],
    "postDate": "2024-01-20T12:00:00.000Z",
    "status": "SCHEDULED",
    "scheduledAt": "2024-01-20T12:00:00.000Z",
    "publishedAt": null,
    "meta": {},
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "archivedAt": null,
    "archivedBy": null,
    "channel": {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "name": "Мой Telegram канал",
      "socialMedia": "TELEGRAM"
    }
  }
]
```

### GET /posts/:id

Получить пост.

### POST /posts

Создать пост.

#### Запрос

```json
{
  "channelId": "990e8400-e29b-41d4-a716-446655440004",
  "content": "Текст поста...",
  "postType": "POST",
  "title": "Заголовок",
  "scheduledAt": "2024-01-20T12:00:00.000Z",
  "status": "SCHEDULED"
}
```

**Параметры:**
- `channelId` (string, required) - ID канала
- `content` (string, required) - содержание поста
- `postType` (PostType, required) - тип поста
- `title` (string, optional) - заголовок
- `description` (string, optional) - описание
- `authorComment` (string, optional) - авторский комментарий к новости (публикуется вместе с контентом)
- `tags` (string, optional) - теги через запятую
- `postDate` (string, optional) - дата поста (ISO 8601)
- `scheduledAt` (string, optional) - дата публикации (ISO 8601)
- `status` (PostStatus, optional) - статус (по умолчанию: DRAFT)
- `socialMedia` (string, optional) - соц. сеть (берется из канала)

#### Ответ

```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440006",
  "publicationId": null,
  "channelId": "990e8400-e29b-41d4-a716-446655440004",
  "authorId": "660e8400-e29b-41d4-a716-446655440001",
  "content": "Текст поста...",
  "socialMedia": "TELEGRAM",
  "postType": "POST",
  "title": "Заголовок",
  "description": null,
  "authorComment": null,
  "tags": null,
  "media": [],
  "postDate": null,
  "status": "SCHEDULED",
  "scheduledAt": "2024-01-20T12:00:00.000Z",
  "publishedAt": null,
  "meta": {},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null
}
```

### PATCH /posts/:id

Обновить пост.

#### Запрос

```json
{
  "content": "Обновленный текст...",
  "scheduledAt": "2024-01-21T12:00:00.000Z"
}
```

### DELETE /posts/:id

Удалить пост.

---

## API Tokens

---

## API Tokens

### GET /api-tokens

Получить список API токенов текущего пользователя.

#### Ответ

```json
[
  {
    "id": "dd0e8400-e29b-41d4-a716-446655440008",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Мой API токен",
    "scopeProjectIds": [
      "550e8400-e29b-41d4-a716-446655440000"
    ],
    "lastUsedAt": "2024-01-20T10:00:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T10:00:00.000Z"
  }
]
```

**Примечание:** Сам токен не возвращается в списке (только при создании).

### POST /api-tokens

Создать новый API токен.

#### Запрос

```json
{
  "name": "Токен для интеграции",
  "scopeProjectIds": [
    "550e8400-e29b-41d4-a716-446655440000"
  ]
}
```

**Параметры:**
- `name` (string, required) - название токена
- `scopeProjectIds` (string[], optional) - массив ID проектов для ограничения доступа (пустой массив = доступ ко всем проектам)

#### Ответ

```json
{
  "id": "dd0e8400-e29b-41d4-a716-446655440008",
  "userId": "660e8400-e29b-41d4-a716-446655440001",
  "name": "Токен для интеграции",
  "plainToken": "gp_1234567890abcdefghijklmnopqrstuvwxyz",
  "scopeProjectIds": [
    "550e8400-e29b-41d4-a716-446655440000"
  ],
  "lastUsedAt": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**⚠️ ВАЖНО:** Токен `plainToken` показывается только один раз при создании! Сохраните его в безопасном месте.

### PATCH /api-tokens/:id

Обновить API токен.

#### Запрос

```json
{
  "name": "Новое название",
  "scopeProjectIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "ee0e8400-e29b-41d4-a716-446655440009"
  ]
}
```

### DELETE /api-tokens/:id

Удалить (отозвать) API токен.

---

## Archive API

### POST /archive/:type/:id

Архивировать сущность.

#### Запрос

```
POST /api/v1/archive/project/550e8400-e29b-41d4-a716-446655440000
```

**Path параметры:**
- `type` (string) - тип сущности: `project`, `channel`, `publication`, `post`
- `id` (string) - ID сущности

#### Ответ

```json
{
  "message": "Entity archived successfully",
  "archivedCount": 15
}
```

**Примечание:** При архивации проекта автоматически архивируются все связанные каналы, публикации и посты (виртуальное каскадирование).

#### Вариант 1: Прямая публикация (standalone)
1. Создается пост напрямую для канала.
2. **Автоматическое создание публикации**: Система автоматически создает родительскую публикацию-контейнер для обеспечения целостности данных (все посты должны принадлежать публикации).
3. Указывается контент, медиафайлы, дата публикации.
4. Устанавливается статус `SCHEDULED`.
5. Пост ожидает публикации в соответствии с расписанием.

#### Вариант 2: Через публикацию

### POST /archive/:type/:id/restore

Восстановить из архива.

#### Запрос

```
POST /api/v1/archive/project/550e8400-e29b-41d4-a716-446655440000/restore
```

#### Ответ

```json
{
  "message": "Entity restored successfully",
  "restoredCount": 15
}
```

### DELETE /archive/:type/:id

Окончательно удалить архивированную сущность.

#### Запрос

```
DELETE /api/v1/archive/project/550e8400-e29b-41d4-a716-446655440000
```

#### Ответ

```json
{
  "message": "Entity permanently deleted"
}
```

### POST /archive/:type/:id/move

Переместить сущность в другой проект.

#### Запрос

```json
{
  "targetProjectId": "ee0e8400-e29b-41d4-a716-446655440009"
}
```

**Параметры:**
- `targetProjectId` (string, required) - ID целевого проекта

#### Ответ

```json
{
  "message": "Entity moved successfully"
}
```

### GET /archive/stats

Получить статистику архива.

#### Ответ

```json
{
  "projects": 2,
  "channels": 5,
  "publications": 12,
  "posts": 48
}
```

### GET /archive/:type

Получить список архивированных элементов.

#### Запрос

```
GET /api/v1/archive/project?limit=20&offset=0
```

**Query параметры:**
- `limit` (number, optional) - количество (по умолчанию: 50)
- `offset` (number, optional) - смещение (по умолчанию: 0)

#### Ответ

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Архивированный проект",
    "archivedAt": "2024-01-18T15:00:00.000Z",
    "archivedBy": "660e8400-e29b-41d4-a716-446655440001"
  }
]
```

---

## Users API

### GET /users/me

Получить информацию о текущем пользователе.

#### Ответ

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "fullName": "John Doe",
  "telegramUsername": "johndoe",
  "avatarUrl": "https://t.me/i/userpic/320/johndoe.jpg",
  "telegramId": "123456789",
  "isAdmin": false,
  "preferences": {},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

### PATCH /users/me

Обновить профиль текущего пользователя.

#### Запрос

```json
{
  "preferences": {
    "theme": "dark",
    "language": "ru"
  }
}
```

### GET /users

Получить список пользователей (только для администраторов).

#### Запрос

```
GET /api/v1/users?limit=50&offset=0
```

#### Ответ

```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "fullName": "John Doe",
      "telegramUsername": "johndoe",
      "telegramId": "123456789",
      "isAdmin": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

---

## Media API

### POST /media/upload

Загрузить файл на сервер.

**Content-Type:** `multipart/form-data`

#### Запрос

- `file` (multipart/field) — загружаемый файл.

#### Ответ

```json
{
  "id": "dd0e8400-e29b-41d4-a716-444455440008",
  "type": "IMAGE",
  "storageType": "FS",
  "storagePath": "uploads/2026/01/uuid.jpg",
  "filename": "original.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 102400,
  "meta": {}
}
```

### POST /media/:id/replace-file

Заменить файл существующего медиа (только для `storageType: FS`) с сохранением того же `Media.id`.

**Content-Type:** `multipart/form-data`

#### Запрос

- `file` (multipart/field) — новый файл.
- `optimize` (multipart/field, optional) — JSON-строка с параметрами оптимизации (как в `/media/upload`).
- `projectId` (multipart/field, optional) — UUID проекта для подстановки дефолтных настроек оптимизации.

#### Ответ

Тот же формат, что и при `/media/upload` (обновлённые `storagePath`, `mimeType`, `sizeBytes`, `meta`).

### POST /media/upload-from-url

Загрузить файл с внешнего URL (сервер скачает его себе).

#### Запрос

```json
{
  "url": "https://example.com/image.jpg",
  "filename": "custom_name.jpg"
}
```

#### Ответ

Тот же, что и при `/media/upload`, но в `meta.originalUrl` сохраняется исходная ссылка.

### GET /media/:id/file

Получить файл (стриминг).

#### Ответ

Бинарные данные файла с соответствующим `Content-Type`.

### GET /media/:id

Получить информацию о медиафайле.

### DELETE /media/:id

Удалить медиафайл (удаляет также физический файл, если `storageType: FS`).

---

## System API

Системные эндпоинты предназначены для интеграции с внешними инструментами автоматизации (например, n8n).

### Аутентификация

Для доступа к System API **обязательно** требуется заголовок `X-System-Token`.
Значение токена должно совпадать с переменной окружения `SYSTEM_API_SECRET`.

```http
X-System-Token: your-secure-system-secret
```

Кроме того, по умолчанию доступ разрешен только из локальных сетей и localhost. Это поведение можно изменить в конфигурации.

### POST /system/schedulers/publications/trigger

Принудительный запуск планировщика публикаций.

#### Запрос
```http
POST /api/v1/system/schedulers/publications/trigger
```

#### Ответ
```json
{
  "status": "triggered",
  "scheduler": "publications"
}
```

### POST /system/schedulers/news/trigger

Принудительный запуск планировщика новостей.

#### Запрос
```http
POST /api/v1/system/schedulers/news/trigger
```

#### Ответ
```json
{
  "status": "triggered",
  "scheduler": "news"
}
```

---

## Health Check

### GET /health

Проверка состояния API.

**Не требует авторизации**

#### Ответ

```json
{
  "status": "ok",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 86400,
  "database": "connected"
}
```

---

## Коды ошибок

### 400 Bad Request

Некорректные данные в запросе.

```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "name must be a string"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized

Отсутствует или невалидный токен аутентификации.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden

Недостаточно прав для выполнения операции.

```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

### 404 Not Found

Запрашиваемый ресурс не найден.

```json
{
  "statusCode": 404,
  "message": "Project not found",
  "error": "Not Found"
}
```

### 409 Conflict

Конфликт данных (например, дубликат).

```json
{
  "statusCode": 409,
  "message": "User already exists in this project",
  "error": "Conflict"
}
```

### 500 Internal Server Error

Внутренняя ошибка сервера.

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Примеры использования

### Пример 1: Создание проекта и канала

```bash
# 1. Получить JWT токен (через Telegram Mini App)
curl -X POST http://localhost:8080/api/v1/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"initData": "..."}'

# Ответ: {"access_token": "eyJ...", "user": {...}}

# 2. Создать проект
curl -X POST http://localhost:8080/api/v1/projects \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Мой блог",
    "description": "Личный блог о технологиях"
  }'

# Ответ: {"id": "550e8400-...", ...}

# 3. Создать канал
curl -X POST http://localhost:8080/api/v1/channels \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-...",
    "socialMedia": "TELEGRAM",
    "name": "Мой Telegram канал",
    "channelIdentifier": "@mychannel",
    "credentials": {
      "botToken": "1234567890:ABC..."
    }
  }'
```

### Пример 2: Создание и планирование публикации

```bash
# 1. Создать публикацию
curl -X POST http://localhost:8080/api/v1/publications \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "550e8400-...",
    "title": "Новая статья",
    "content": "Текст статьи...",
    "tags": "технологии,AI"
  }'

# Ответ: {"id": "aa0e8400-...", ...}

# 2. Запланировать публикацию в каналы
curl -X POST http://localhost:8080/api/v1/publications/aa0e8400-.../schedule \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "channelIds": ["990e8400-..."],
    "scheduledAt": "2024-01-20T12:00:00.000Z"
  }'
```

### Пример 3: Использование API токена

```bash
# 1. Создать API токен
curl -X POST http://localhost:8080/api/v1/api-tokens \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Токен для интеграции",
    "scopeProjectIds": ["550e8400-..."]
  }'

# Ответ: {"plainToken": "gp_1234567890...", ...}

# 2. Использовать API токен для запросов
curl -X GET http://localhost:8080/api/v1/projects \
  -H "x-api-key: gp_1234567890..."
```

---

**Дополнительная информация:**
- [README.md](../README.md) - Общая информация о проекте
- [CONFIGURATION.md](CONFIGURATION.md) - Конфигурация приложения
- [DEPLOYMENT.md](DEPLOYMENT.md) - Развертывание в продакшн
