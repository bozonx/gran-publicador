# API Документация Gran Publicador

## Содержание

- [Базовая информация](#базовая-информация)
- [Аутентификация](#аутентификация)
- [Общие параметры и ответы](#общие-параметры-и-ответы)
- [Auth API](#auth-api)
- [Projects API](#projects-api)
- [Channels API](#channels-api)
- [Publications API](#publications-api)
- [Posts API](#posts-api)
- [API Tokens](#api-tokens)
- [Archive API](#archive-api)
- [Users API](#users-api)
- [Health Check](#health-check)
- [Коды ошибок](#коды-ошибок)

## Базовая информация

### Base URL

- **Development**: `http://localhost:8080/api/v1`
- **Production**: `https://your-domain.com/api/v1`

### Content Type

Все запросы и ответы используют JSON:

```
Content-Type: application/json
```

### Формат дат

Все даты в формате ISO 8601:

```
2024-01-15T10:30:00.000Z
```

## Аутентификация

Все эндпоинты (кроме `/auth/telegram`) требуют аутентификации одним из двух способов:

### 1. JWT токен (для фронтенда)

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. API токен (для внешних интеграций)

Вариант 1 (рекомендуется):
```http
x-api-key: gp_1234567890abcdef...
```

Вариант 2:
```http
Authorization: Bearer gp_1234567890abcdef...
```

## Общие параметры и ответы

### Пагинация

Параметры запроса:
- `limit` (number, optional) - количество элементов (по умолчанию: 50, максимум: 100)
- `offset` (number, optional) - смещение (по умолчанию: 0)

Пример:
```
GET /api/v1/projects?limit=20&offset=40
```

### Формат ошибок

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

или с деталями:

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

### Enum значения

#### ProjectRole
- `OWNER` - владелец проекта
- `ADMIN` - администратор
- `EDITOR` - редактор
- `VIEWER` - наблюдатель

#### SocialMedia
- `TELEGRAM`
- `INSTAGRAM`
- `VK`
- `YOUTUBE`
- `TIKTOK`
- `X`
- `FACEBOOK`
- `LINKEDIN`
- `SITE`

#### PostType
- `POST` - обычный пост
- `ARTICLE` - статья
- `NEWS` - новость
- `VIDEO` - видео
- `SHORT` - короткое видео
- `STORY` - история

#### PostStatus
- `DRAFT` - черновик
- `SCHEDULED` - запланировано
- `PUBLISHED` - опубликовано
- `FAILED` - ошибка публикации
- `EXPIRED` - истекло

---

## Auth API

### POST /auth/telegram

Аутентификация через Telegram Mini App.

**Не требует авторизации**

#### Запрос

```json
{
  "initData": "user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&hash=abc123..."
}
```

**Параметры:**
- `initData` (string, required) - данные инициализации от Telegram WebApp

#### Ответ

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegramId": "123456789",
    "fullName": "John Doe",
    "telegramUsername": "johndoe",
    "avatarUrl": "https://t.me/i/userpic/320/johndoe.jpg",
    "isAdmin": false,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Коды ответов

- `200 OK` - успешная аутентификация
- `401 Unauthorized` - неверная подпись Telegram
- `400 Bad Request` - некорректные данные

---

## Projects API

### GET /projects

Получить список проектов текущего пользователя.

#### Запрос

```
GET /api/v1/projects?limit=20&offset=0
```

**Query параметры:**
- `limit` (number, optional) - количество проектов (по умолчанию: 50)
- `offset` (number, optional) - смещение (по умолчанию: 0)

#### Ответ

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Мой блог",
    "description": "Личный блог о технологиях",
    "ownerId": "660e8400-e29b-41d4-a716-446655440001",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "archivedAt": null,
    "archivedBy": null,
    "role": "OWNER",
    "channelCount": 3,
    "postCount": 42,
    "lastPostAt": "2024-01-20T15:45:00.000Z"
  }
]
```

### GET /projects/:id

Получить информацию о проекте.

#### Запрос

```
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440000
```

#### Ответ

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Мой блог",
  "description": "Личный блог о технологиях",
  "ownerId": "660e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null,
  "role": "OWNER",
  "channelCount": 3,
  "postCount": 42,
  "lastPostAt": "2024-01-20T15:45:00.000Z",
  "owner": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Doe",
    "telegramUsername": "johndoe"
  },
  "members": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "userId": "880e8400-e29b-41d4-a716-446655440003",
      "role": "EDITOR",
      "createdAt": "2024-01-16T12:00:00.000Z",
      "user": {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "fullName": "Jane Smith",
        "telegramUsername": "janesmith"
      }
    }
  ]
}
```

#### Коды ответов

- `200 OK` - успешно
- `404 Not Found` - проект не найден
- `403 Forbidden` - нет доступа к проекту

### POST /projects

Создать новый проект.

#### Запрос

```json
{
  "name": "Новый проект",
  "description": "Описание проекта"
}
```

**Параметры:**
- `name` (string, required) - название проекта
- `description` (string, optional) - описание проекта

#### Ответ

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Новый проект",
  "description": "Описание проекта",
  "ownerId": "660e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null
}
```

#### Коды ответов

- `201 Created` - проект создан
- `400 Bad Request` - некорректные данные

### PATCH /projects/:id

Обновить проект.

#### Запрос

```json
{
  "name": "Обновленное название",
  "description": "Новое описание"
}
```

**Параметры:**
- `name` (string, optional) - новое название
- `description` (string, optional) - новое описание

#### Ответ

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Обновленное название",
  "description": "Новое описание",
  "ownerId": "660e8400-e29b-41d4-a716-446655440001",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z",
  "archivedAt": null,
  "archivedBy": null
}
```

#### Коды ответов

- `200 OK` - проект обновлен
- `404 Not Found` - проект не найден
- `403 Forbidden` - недостаточно прав (требуется ADMIN или OWNER)

### DELETE /projects/:id

Удалить проект.

**Требуется роль:** OWNER

#### Запрос

```
DELETE /api/v1/projects/550e8400-e29b-41d4-a716-446655440000
```

#### Ответ

```json
{
  "message": "Project deleted successfully"
}
```

#### Коды ответов

- `200 OK` - проект удален
- `404 Not Found` - проект не найден
- `403 Forbidden` - недостаточно прав (требуется OWNER)

### POST /projects/:id/members

Добавить участника в проект.

**Требуется роль:** ADMIN или OWNER

#### Запрос

```json
{
  "telegramUsername": "newuser",
  "role": "EDITOR"
}
```

**Параметры:**
- `telegramUsername` (string, required) - username в Telegram
- `role` (ProjectRole, required) - роль участника

#### Ответ

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "880e8400-e29b-41d4-a716-446655440003",
  "role": "EDITOR",
  "createdAt": "2024-01-16T12:00:00.000Z"
}
```

### PATCH /projects/:projectId/members/:memberId

Изменить роль участника.

**Требуется роль:** ADMIN или OWNER

#### Запрос

```json
{
  "role": "ADMIN"
}
```

### DELETE /projects/:projectId/members/:memberId

Удалить участника из проекта.

**Требуется роль:** ADMIN или OWNER

---

## Channels API

### GET /channels

Получить список каналов.

#### Запрос

```
GET /api/v1/channels?projectId=550e8400-e29b-41d4-a716-446655440000&limit=20
```

**Query параметры:**
- `projectId` (string, optional) - фильтр по проекту
- `socialMedia` (SocialMedia, optional) - фильтр по соц. сети
- `isActive` (boolean, optional) - фильтр по активности
- `limit` (number, optional) - количество (по умолчанию: 50)
- `offset` (number, optional) - смещение (по умолчанию: 0)

#### Ответ

```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "socialMedia": "TELEGRAM",
    "name": "Мой Telegram канал",
    "channelIdentifier": "@mychannel",
    "credentials": {
      "botToken": "1234567890:ABC..."
    },
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "archivedAt": null,
    "archivedBy": null,
    "postCount": 15,
    "lastPostAt": "2024-01-20T15:45:00.000Z"
  }
]
```

### GET /channels/:id

Получить информацию о канале.

#### Ответ

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "socialMedia": "TELEGRAM",
  "name": "Мой Telegram канал",
  "channelIdentifier": "@mychannel",
  "credentials": {
    "botToken": "1234567890:ABC..."
  },
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null,
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Мой блог"
  }
}
```

### POST /channels

Создать новый канал.

#### Запрос

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "socialMedia": "TELEGRAM",
  "name": "Новый канал",
  "channelIdentifier": "@newchannel",
  "credentials": {
    "botToken": "1234567890:ABC..."
  },
  "isActive": true
}
```

**Параметры:**
- `projectId` (string, required) - ID проекта
- `socialMedia` (SocialMedia, required) - тип соц. сети
- `name` (string, required) - название канала
- `channelIdentifier` (string, required) - идентификатор канала (@username, URL и т.д.)
- `credentials` (object, optional) - учетные данные (токены, ключи API)
- `isActive` (boolean, optional) - активен ли канал (по умолчанию: true)

#### Ответ

```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "socialMedia": "TELEGRAM",
  "name": "Новый канал",
  "channelIdentifier": "@newchannel",
  "credentials": {
    "botToken": "1234567890:ABC..."
  },
  "isActive": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null
}
```

### PATCH /channels/:id

Обновить канал.

#### Запрос

```json
{
  "name": "Обновленное название",
  "isActive": false
}
```

**Параметры:**
- `name` (string, optional) - новое название
- `channelIdentifier` (string, optional) - новый идентификатор
- `credentials` (object, optional) - новые учетные данные
- `isActive` (boolean, optional) - активность канала

### DELETE /channels/:id

Удалить канал.

---

## Publications API

### GET /publications

Получить список публикаций.

#### Запрос

```
GET /api/v1/publications?projectId=550e8400-e29b-41d4-a716-446655440000&status=DRAFT
```

**Query параметры:**
- `projectId` (string, optional) - фильтр по проекту
- `status` (PostStatus, optional) - фильтр по статусу
- `limit` (number, optional) - количество (по умолчанию: 50)
- `offset` (number, optional) - смещение (по умолчанию: 0)

#### Ответ

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "projectId": "550e8400-e29b-41d4-a716-446655440000",
    "authorId": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Новая статья",
    "content": "Содержание публикации...",
    "mediaFiles": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ],
    "tags": "технологии,программирование",
    "status": "DRAFT",
    "meta": {},
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "archivedAt": null,
    "archivedBy": null,
    "author": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "fullName": "John Doe"
    }
  }
]
```

### GET /publications/:id

Получить публикацию.

#### Ответ

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "authorId": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Новая статья",
  "content": "Содержание публикации...",
  "mediaFiles": [
    "https://example.com/image1.jpg"
  ],
  "tags": "технологии,программирование",
  "status": "DRAFT",
  "meta": {},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null,
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Мой блог"
  },
  "author": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "fullName": "John Doe"
  },
  "posts": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440006",
      "channelId": "990e8400-e29b-41d4-a716-446655440004",
      "status": "SCHEDULED",
      "scheduledAt": "2024-01-20T12:00:00.000Z"
    }
  ]
}
```

### POST /publications

Создать публикацию.

#### Запрос

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Новая публикация",
  "content": "Текст публикации...",
  "mediaFiles": [
    "https://example.com/image.jpg"
  ],
  "tags": "технологии,AI",
  "status": "DRAFT"
}
```

**Параметры:**
- `projectId` (string, required) - ID проекта
- `title` (string, optional) - заголовок
- `content` (string, required) - содержание
- `mediaFiles` (string[], optional) - массив URL медиафайлов
- `tags` (string, optional) - теги через запятую
- `status` (PostStatus, optional) - статус (по умолчанию: DRAFT)
- `meta` (object, optional) - дополнительные метаданные

#### Ответ

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "authorId": "660e8400-e29b-41d4-a716-446655440001",
  "title": "Новая публикация",
  "content": "Текст публикации...",
  "mediaFiles": [
    "https://example.com/image.jpg"
  ],
  "tags": "технологии,AI",
  "status": "DRAFT",
  "meta": {},
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "archivedAt": null,
  "archivedBy": null
}
```

### PATCH /publications/:id

Обновить публикацию.

#### Запрос

```json
{
  "title": "Обновленный заголовок",
  "content": "Обновленный текст...",
  "status": "SCHEDULED"
}
```

### DELETE /publications/:id

Удалить публикацию.

### POST /publications/:id/schedule

Запланировать публикацию в каналы.

#### Запрос

```json
{
  "channelIds": [
    "990e8400-e29b-41d4-a716-446655440004",
    "cc0e8400-e29b-41d4-a716-446655440007"
  ],
  "scheduledAt": "2024-01-20T12:00:00.000Z"
}
```

**Параметры:**
- `channelIds` (string[], required) - массив ID каналов
- `scheduledAt` (string, required) - дата и время публикации (ISO 8601)

#### Ответ

```json
{
  "message": "Publication scheduled successfully",
  "posts": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440006",
      "publicationId": "aa0e8400-e29b-41d4-a716-446655440005",
      "channelId": "990e8400-e29b-41d4-a716-446655440004",
      "status": "SCHEDULED",
      "scheduledAt": "2024-01-20T12:00:00.000Z"
    }
  ]
}
```

---

## Posts API

### GET /posts

Получить список постов.

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
    "mediaFiles": [
      "https://example.com/image.jpg"
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
  "mediaFiles": [
    "https://example.com/image.jpg"
  ],
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
- `mediaFiles` (string[], optional) - массив URL медиафайлов
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
  "mediaFiles": [
    "https://example.com/image.jpg"
  ],
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
    "mediaFiles": ["https://example.com/image.jpg"],
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
