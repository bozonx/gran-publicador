# API Reference — Gran Publicador

Настоящий документ содержит подробное описание всех эндпоинтов API системы Gran Publicador. 

Общие сведения об архитектуре, установке и принципе работы системы находятся в [README.md](../README.md).

## Содержание

- [Общая информация](#общая-информация)
- [Аутентификация](#аутентификация)
- [Auth API](#auth-api)
- [Projects API](#projects-api)
- [Channels API](#channels-api)
- [Author Signatures API](#author-signatures-api)
- [Publications API](#publications-api)
- [Publication Relations API](#publication-relations-api)
- [Project Templates API](#project-templates-api)
- [Posts API](#posts-api)
- [Content Library API](#content-library-api)
- [News Queries API](#news-queries-api)
- [LLM API](#llm-api)
- [LLM Prompt Templates API](#llm-prompt-templates-api)
- [Translate API](#translate-api)
- [Notifications API](#notifications-api)
- [Media API](#media-api)
- [API Tokens](#api-tokens)
- [Archive API](#archive-api)
- [Users API](#users-api)
- [System API](#system-api)
- [Health Check](#health-check)
- [Коды ошибок](#коды-ошибок)
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
| `groupId` | UUID | Нет | Фильтр по группе (вернуть элементы, привязанные к группе) |
| `search` | string | Нет | Поиск по `title`, `note`, `tags`, `text` |
| `limit` | number | Нет | Лимит (см. [Пагинация](#пагинация-query-параметры)) |
| `offset` | number | Нет | Смещение (см. [Пагинация](#пагинация-query-параметры)) |
| `includeArchived` | boolean | Нет | Включить архивные вместе с активными |
| `archivedOnly` | boolean | Нет | Вернуть только архивные |
| `includeMedia` | boolean | Нет | Включить `media` в ответ (по умолчанию `true`). Для ускорения списков можно передать `false` |

### GET `/content-library/collections/:id/items`

Получить список элементов конкретной коллекции.

**Важно:** для коллекций типа `PUBLICATION_MEDIA_VIRTUAL` эндпоинт возвращает публикации, замапленные в формат карточек Content Library (виртуальные элементы).

Поведение по `scope`:

- `scope=personal` — публикации по **всем** проектам, к которым у пользователя есть доступ.
- `scope=project` — публикации **только** выбранного проекта (`projectId`).

**Path параметры:**

| Параметр | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `id` | UUID | Да | ID коллекции |

**Query параметры:**

| Параметр | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `scope` | string | Да | `personal` или `project` |
| `projectId` | UUID | Нет* | Обязателен при `scope=project` |
| `search` | string | Нет | Поиск |
| `tags` | string | Нет | Теги, строка через запятую (`tag1,tag2`) |
| `sortBy` | string | Нет | `combined` или `title` (для виртуальной коллекции), `createdAt/title` (для обычных элементов) |
| `sortOrder` | string | Нет | `asc` или `desc` |
| `limit` | number | Нет | Лимит (см. [Пагинация](#пагинация-query-параметры)) |
| `offset` | number | Нет | Смещение (см. [Пагинация](#пагинация-query-параметры)) |
| `orphansOnly` | boolean | Нет | Только для `SAVED_VIEW`: показать элементы без групп |

### POST `/content-library/items`

Создать новый элемент библиотеки.

**Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `scope` | string | Да | `personal` или `project` |
| `projectId` | UUID | Нет* | Обязателен при `scope=project` |
| `groupId` | UUID | Нет | Добавить элемент в группу (создаётся связь с группой) |
| `title` | string | Нет | Заголовок |
| `tags` | string[] | Нет | Массив тегов |
| `note` | string | Нет | Заметка |
| `text` | string | Нет | Текст элемента |
| `meta` | object | Нет | JSON метаданные элемента |
| `media` | array | Нет | Список привязанных медиа (links) |

Примечание: пустые элементы допустимы (создаются UI сразу при нажатии "создать").

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

### Поведение групп (важно)

- Прямое удаление элемента из группы отдельным endpoint не поддерживается.
- Элементы перемещаются между группами через операции перемещения.
- При удалении группы сами элементы не удаляются: у элементов удаляемой группы удаляются связи с этой группой.

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

## Sources API

Проксирование запросов к News Service для получения списка источников новостей и их тегов.

### GET `/sources`
Получить список источников новостей. Поддерживает параметры фильтрации и пагинации, которые передаются напрямую в News Service.

### GET `/sources/tags`
Получить список тегов источников новостей.

### GET `/sources/tags/categories`
Получить список категорий тегов источников новостей.

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

Дополнительно, каждый элемент `channels[]` может содержать:

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `maxContentLength` | number | Нет | Лимит длины контента поста (в символах) для данного канала. Если задан и `publication.content` превышает лимит, модель вернёт укороченную версию в `posts[].content`. |

---

## System API (Schedulers)

Ручной запуск задач публикации и обслуживания.

Поддерживается два способа авторизации:
- `X-System-Token` (для system-to-system вызовов)
- обычная пользовательская JWT-сессия с правами администратора приложения

### POST `/system/schedulers/publications/run`
Запуск обработки публикаций, у которых наступило время публикации.

### POST `/system/schedulers/news/run`
Запуск проверки новостей и генерации уведомлений.

### POST `/system/schedulers/maintenance/run`
Запуск полного обслуживания: публикации + новости + очистка старых уведомлений.

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

Источник правды по поддерживаемым платформам и их возможностям/лимитам:
- [`packages/shared/src/social-media-platforms.constants.ts`](../packages/shared/src/social-media-platforms.constants.ts)

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

---

## Posts API

### GET `/posts`

Получить список постов.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `channelId` | UUID | Фильтр по каналу |
| `publicationId` | UUID | Фильтр по публикации |
| `status` | Enum | Фильтр по статусу |
| `limit` | number | Количество (по умолчанию: 50) |
| `offset` | number | Смещение (по умолчанию: 0) |

### GET `/posts/:id`

Получить пост.

### POST `/posts`

Создать пост.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `channelId` | UUID | Да | ID канала |
| `content` | string | Да | Содержание поста |
| `postType` | Enum | Да | Тип поста |
| `title` | string | Нет | Заголовок |
| `description` | string | Нет | Описание |
| `authorComment` | string | Нет | Авторский комментарий |
| `tags` | string | Нет | Теги через запятую |
| `scheduledAt` | string | Нет | Дата публикации (ISO 8601) |
| `status` | Enum | Нет | Статус (по умолчанию: `DRAFT`) |

### PATCH `/posts/:id`

Обновить пост.

### DELETE `/posts/:id`

Удалить пост.

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

### POST `/archive/:type/:id`

Архивировать сущность.

**Path параметры:**
- `type` — тип сущности: `project`, `channel`, `publication`, `post`
- `id` — ID сущности

**Примечание:** При архивации проекта автоматически архивируются все связанные каналы, публикации и посты (виртуальное каскадирование).

### POST `/archive/:type/:id/restore`

Восстановить из архива.

### DELETE `/archive/:type/:id`

Окончательно удалить архивированную сущность.

### POST `/archive/:type/:id/move`

Переместить сущность в другой проект.

**Body:** `{ "targetProjectId": "<UUID>" }`

### GET `/archive/stats`

Получить статистику архива (`projects`, `channels`, `publications`, `posts`).

### GET `/archive/:type`

Получить список архивированных элементов. Поддерживает `limit` / `offset`.

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

## Publication Relations API

Управление группами связей публикаций (серии, локализации).

### GET `/publications/:id/relations`

Получить все группы связей для публикации.

### POST `/publications/:id/relations/link`

Связать публикацию с другой через группу.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `targetPublicationId` | UUID | Да | ID целевой публикации |
| `relationType` | Enum | Да | `SERIES` или `TRANSLATION` |
| `groupId` | UUID | Нет | ID существующей группы (если не указан — создаётся новая) |

### POST `/publications/:id/relations/unlink`

Удалить связь публикации с группой.

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `groupId` | UUID | Да | ID группы связей |

### POST `/publications/:id/relations/create-related`

Создать новую публикацию на основе текущей и связать их.

### PATCH `/publications/relation-groups/:groupId/reorder`

Изменить порядок публикаций внутри группы связей.

---

## Project Templates API

Шаблоны публикаций на уровне проекта.

### GET `/projects/:projectId/templates`

Получить список шаблонов проекта.

### GET `/projects/:projectId/templates/:templateId`

Получить шаблон по ID.

### POST `/projects/:projectId/templates`

Создать шаблон.

### PATCH `/projects/:projectId/templates/reorder`

Изменить порядок шаблонов.

### PATCH `/projects/:projectId/templates/:templateId`

Обновить шаблон.

### DELETE `/projects/:projectId/templates/:templateId`

Удалить шаблон.

---

## LLM Prompt Templates API

Управление шаблонами промптов (личные, проектные, системные). Требует JWT-аутентификации.

### GET `/llm-prompt-templates/available`

Получить агрегированный список доступных шаблонов для пользователя.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `projectId` | UUID | Опционально — включить шаблоны проекта |

### GET `/llm-prompt-templates/system`

Получить системные шаблоны. `?includeHidden=true` — включить скрытые.

### POST `/llm-prompt-templates/system/:systemId/hide`

Скрыть системный шаблон для текущего пользователя.

### POST `/llm-prompt-templates/system/:systemId/unhide`

Показать скрытый системный шаблон.

### GET `/llm-prompt-templates/user/:userId`

Получить личные шаблоны пользователя (только свои).

### GET `/llm-prompt-templates/project/:projectId`

Получить шаблоны проекта.

### POST `/llm-prompt-templates`

Создать шаблон.

### GET `/llm-prompt-templates/:id`

Получить шаблон по ID.

### PATCH `/llm-prompt-templates/:id`

Обновить шаблон.

### DELETE `/llm-prompt-templates/:id`

Удалить шаблон.

### POST `/llm-prompt-templates/:id/hide`

Скрыть шаблон.

### POST `/llm-prompt-templates/:id/unhide`

Показать шаблон.

### POST `/llm-prompt-templates/reorder`

Изменить порядок шаблонов. **Body:** `{ "ids": ["<UUID>", ...] }`

### POST `/llm-prompt-templates/available/order`

Сохранить пользовательский порядок агрегированного списка.

**Body:**

| Поле | Тип | Описание |
| :--- | :--- | :--- |
| `ids` | string[] | Упорядоченный список ID |
| `projectId` | UUID | Опционально — для проектного скоупа |

---

## Translate API

Перевод текста через Translation Gateway микросервис. Требует JWT-аутентификации.

### POST `/translate`

**Параметры Body:**

| Поле | Тип | Обязательно | Описание |
| :--- | :--- | :---: | :--- |
| `text` | string | Да | Исходный текст |
| `targetLang` | string | Да | Целевой язык (BCP-47, напр. `ru-RU`) |
| `sourceLang` | string | Нет | Исходный язык (авто-определение если не указан) |
| `provider` | string | Нет | Провайдер перевода (`anylang`, `google`, `deepl` и др.) |
| `model` | string | Нет | Модель провайдера |
| `splitter` | string | Нет | Стратегия разбивки текста: `paragraph`, `markdown`, `sentence`, `off` |
| `timeoutSec` | number | Нет | Таймаут запроса (сек, 1–600) |

---

## Notifications API

Уведомления о новостях и событиях. Требует JWT-аутентификации.

### GET `/notifications`

Получить список уведомлений текущего пользователя.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `isRead` | boolean | Фильтр по статусу прочтения |
| `limit` | number | Лимит (см. [Пагинация](#пагинация-query-параметры)) |
| `offset` | number | Смещение |

### GET `/notifications/unread-count`

Получить количество непрочитанных уведомлений. **Ответ:** `{ "count": 5 }`

### PATCH `/notifications/:id/read`

Отметить уведомление как прочитанное.

### PATCH `/notifications/read-all`

Отметить все уведомления пользователя как прочитанные.

### WebSocket

Для получения уведомлений в реальном времени подключитесь к WebSocket:

```
ws://<host>/notifications
```

Аутентификация: передайте JWT в `handshake.auth.token` или в заголовке `Authorization: Bearer <token>`.

Сервер эмитирует событие `notification` при появлении нового уведомления.

---

## Tags API

### GET `/tags/search`

Поиск тегов по скоупу проекта или пользователя.

**Query параметры:**

| Параметр | Тип | Описание |
| :--- | :--- | :--- |
| `projectId` | UUID | Поиск по тегам проекта (взаимоисключает с `userId`) |
| `userId` | UUID | Поиск по личным тегам (только свои) |
| `query` | string | Строка поиска |

---

## Media API

### POST /media/upload

Загрузить файл на сервер.

Примечание по оптимизации изображений:
- backend может принять `optimize` параметры от клиента;
- если глобальная оптимизация включена, backend всегда форсирует значения `format`, `maxDimension`, `effort`, `quality`, `chromaSubsampling`, `lossless` из env (`MEDIA_IMAGE_OPTIMIZATION_*`) перед отправкой в Media Storage.

**Content-Type:** `multipart/form-data`

#### Запрос

- `file` (multipart/field) — загружаемый файл.
- `optimize` (multipart/field, optional) — JSON-строка с дополнительными параметрами оптимизации.

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

`format`, `maxDimension`, `effort`, `quality`, `chromaSubsampling`, `lossless` при включенной оптимизации форсируются backend из env и не управляются UI.

#### Ответ

Тот же формат, что и при `/media/upload` (обновлённые `storagePath`, `mimeType`, `sizeBytes`, `meta`).

### POST /media/upload-from-url

Загрузить файл с внешнего URL (сервер скачает его себе).

Оптимизация изображений работает по той же схеме, что и `/media/upload`: backend форсирует `format`, `maxDimension`, `effort`, `quality`, `chromaSubsampling`, `lossless` из env при включенной глобальной оптимизации.

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

Для доступа к System API используется один из вариантов:

1. `X-System-Token`:
   - значение токена должно совпадать с переменной окружения `SYSTEM_API_SECRET`
2. JWT-сессия пользователя:
   - пользователь должен иметь флаг `isAdmin=true`

```http
X-System-Token: your-secure-system-secret
```

Для запросов с `X-System-Token` дополнительно действует ограничение по локальной сети (localhost/RFC1918), если включён `SYSTEM_API_IP_RESTRICTION_ENABLED`.

### POST /system/schedulers/publications/run

Ручной запуск публикаций, для которых наступило время отправки.

#### Запрос
```http
POST /api/v1/system/schedulers/publications/run
```

#### Ответ
```json
{
  "status": "completed",
  "scheduler": "publications",
  "result": {
    "skipped": false,
    "expiredPublicationsCount": 0,
    "expiredPostsCount": 0,
    "triggeredPublicationsCount": 2
  }
}
```

### POST /system/schedulers/news/run

Ручной запуск проверки новостей и уведомлений.

#### Запрос
```http
POST /api/v1/system/schedulers/news/run
```

#### Ответ
```json
{
  "status": "completed",
  "scheduler": "news",
  "result": {
    "skipped": false,
    "checkedQueriesCount": 3,
    "failedQueriesCount": 0,
    "queriesWithNewItemsCount": 1,
    "createdNotificationsCount": 2
  }
}
```

### POST /system/schedulers/maintenance/run

Полный ручной запуск обслуживания (публикации + новости + очистка уведомлений).

#### Запрос
```http
POST /api/v1/system/schedulers/maintenance/run
```

#### Ответ
```json
{
  "status": "completed",
  "scheduler": "maintenance",
  "result": {
    "publications": {
      "skipped": false,
      "expiredPublicationsCount": 0,
      "expiredPostsCount": 0,
      "triggeredPublicationsCount": 2
    },
    "news": {
      "skipped": false,
      "checkedQueriesCount": 3,
      "failedQueriesCount": 0,
      "queriesWithNewItemsCount": 1,
      "createdNotificationsCount": 2
    },
    "notificationsCleanup": {
      "cleanupDays": 30,
      "deletedCount": 12
    }
  }
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
