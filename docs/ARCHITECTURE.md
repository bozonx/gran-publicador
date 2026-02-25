# Архитектура Gran Publicador

## Содержание

- [Общая архитектура](#общая-архитектура)
- [Backend архитектура](#backend-архитектура)
- [Frontend архитектура](#frontend-архитектура)
- [База данных](#база-данных)
- [Безопасность](#безопасность)
- [Паттерны и практики](#паттерны-и-практики)
- [Масштабируемость](#масштабируемость)

## Общая архитектура

Gran Publicador построен по принципу **монолитной архитектуры** с разделением на Backend (NestJS) и Frontend (Nuxt), разворачиваемых как отдельные приложения.

```
┌─────────────────────────────────────────────────────────┐
│                    Telegram Mini App                     │
│                    (Telegram WebApp)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ initData (авторизация)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Nuxt 4)                      │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Components  │  Pages  │  Stores  │  Composables │   │
│  └──────────────────────────────────────────────────┘   │
│                    SPA (SSR: false)                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTP/JSON (REST API)
                     │ JWT / API Token
                     │ WebSocket (Socket.IO) — уведомления
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (NestJS + Fastify)              │
│  ┌──────────────────────────┐  ┌───────────────────────┐ │
│  │       API Server         │  │   Background Worker   │ │
│  │ (Controllers, WebSockets)│  │ (BullMQ, Publications)│ │
│  └──────────────────────────┘  └───────────────────────┘ │
│                    REST API (/api/v1/*)                  │
└────────────────────┬────────────────────────┬────────────┘
                     │                        │
                     │ Prisma ORM             │ Redis (Queues)
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Database (PostgreSQL)                  │
│              gran_db (в Docker контейнере)               │
└─────────────────────────────────────────────────────────┘
```

1. **API Server** - обрабатывает HTTP и WebSocket запросы
2. **Background Worker** - обрабатывает фоновые задачи (очереди публикаций) из Redis (BullMQ), не поднимает HTTP сервер

### Ключевые принципы

1. **Монолит с модульной структурой** - единое приложение, но четко разделенное на модули
2. **API-first подход** - все взаимодействие через REST API
3. **Типобезопасность** - TypeScript на всех уровнях
4. **Конфигурация как код** - YAML конфигурация с hot-reload
5. **Безопасность по умолчанию** - все эндпоинты защищены


### Технологический стек

- **NestJS 11** - модульный фреймворк
- **Fastify** - HTTP сервер (быстрее Express)
- **Prisma 7** - ORM с типобезопасностью
- **PostgreSQL 18** - реляционная БД
- **Passport + JWT** - аутентификация
- **Pino** - структурированное логирование
- **class-validator** - валидация DTO

### Структура модулей

```
src/
├── common/                      # Общие компоненты
│   ├── constants/               # Константы приложения
│   ├── decorators/              # Кастомные декораторы
│   ├── filters/                 # Exception filters
│   ├── guards/                  # Guards для защиты эндпоинтов
│   │   ├── jwt-or-api-token.guard.ts   # JWT или API токен
│   │   ├── jwt-auth.guard.ts           # Только JWT
│   │   └── api-token.guard.ts          # Только API токен
│   ├── pipes/                   # Validation pipes
│   ├── services/                # Общие сервисы
│   │   └── permissions.service.ts      # Проверка прав доступа
│   └── types/                   # Общие типы
│
├── config/                      # Конфигурация
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── llm.config.ts
│   ├── media.config.ts
│   ├── redis.config.ts
│   ├── stt.config.ts
│   └── translate.config.ts
│
├── modules/                     # Бизнес-модули
│   ├── api-tokens/              # API токены
│   ├── archive/                 # Система архивирования (soft delete, restore, move)
│   ├── auth/                    # Аутентификация (Telegram initData → JWT)
│   ├── author-signatures/       # Подписи авторов с языковыми вариантами
│   ├── channels/                # Управление каналами соцсетей
│   ├── content-library/         # Библиотека контента (personal/project scope)
│   ├── health/                  # Health check
│   ├── llm/                     # LLM генерация текста
│   ├── llm-prompt-templates/    # Шаблоны промптов (личные и проектные)
│   ├── media/                   # Медиафайлы (upload, stream, replace)
│   ├── news-queries/            # Запросы для автосбора новостей
│   ├── notifications/           # Уведомления (REST + WebSocket/Socket.IO)
│   ├── posts/                   # Посты (привязаны к публикациям и каналам)
│   ├── prisma/                  # Prisma сервис
│   ├── project-templates/       # Шаблоны публикаций уровня проекта
│   ├── projects/                # Управление проектами и участниками
│   ├── publication-relations/   # Связи публикаций (SERIES, LOCALIZATION)
│   ├── publications/            # Публикации (контент, планирование, LLM-чат)
│   ├── roles/                   # Управление ролями участников проекта
│   ├── social-posting/          # Планировщик публикаций в соцсети
│   ├── sources/                 # Источники новостей и их теги
│   ├── stt/                     # Speech-To-Text (WebSocket gateway)
│   ├── system/                  # Системные эндпоинты (schedulers)
│   ├── tags/                    # Поиск тегов по проекту/пользователю
│   ├── telegram-bot/            # Telegram бот (сбор контента в библиотеку)
│   ├── translate/               # Перевод текста через Translation Gateway
│   └── users/                   # Управление пользователями
│
├── app.module.ts                # Главный модуль
└── main.ts                      # Точка входа
```

### Слои приложения

#### 1. Controller Layer (Контроллеры)

Отвечают за обработку HTTP запросов и валидацию входных данных.

```typescript
@Controller('projects')
@UseGuards(JwtOrApiTokenGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  public create(@Request() req: UnifiedAuthRequest, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(req.user.userId, dto);
  }
}
```

**Ответственность:**
- Маршрутизация запросов
- Валидация DTO через class-validator
- Применение guards и декораторов
- Делегирование бизнес-логики в сервисы

#### 2. Service Layer (Сервисы)

Содержат бизнес-логику приложения.

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(userId: string, dto: CreateProjectDto) {
    // Бизнес-логика создания проекта
    return this.prisma.project.create({
      data: { ...dto, ownerId: userId }
    });
  }
}
```

**Ответственность:**
- Бизнес-логика
- Работа с БД через Prisma
- Проверка прав доступа
- Обработка ошибок

#### 3. Data Access Layer (Prisma)

Единая точка доступа к базе данных.

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

**Ответственность:**
- Подключение к БД
- Транзакции
- Миграции
- Типобезопасные запросы

### Модульная архитектура

Каждый модуль следует единой структуре:

```
module-name/
├── dto/                         # Data Transfer Objects
│   ├── create-module.dto.ts     # DTO для создания
│   ├── update-module.dto.ts     # DTO для обновления
│   └── index.ts                 # Экспорты
├── module-name.controller.ts    # HTTP контроллер
├── module-name.service.ts       # Бизнес-логика
├── module-name.module.ts        # NestJS модуль
└── index.ts                     # Экспорты модуля
```

### Ключевые модули

#### AuthModule
- Аутентификация через Telegram (проверка initData)
- Генерация JWT токенов
- JWT стратегия для Passport

#### ApiTokensModule
- Создание пользовательских API токенов
- Хеширование и шифрование токенов
- Scope-based доступ (ограничение по проектам)
- Guard для проверки API токенов

#### ArchiveModule
- Мягкое удаление (soft delete)
- Виртуальное каскадное архивирование
- Восстановление из архива
- Перемещение между проектами
- Окончательное удаление

#### NotificationsModule
- REST эндпоинты: список, счётчик непрочитанных, отметить прочитанным
- WebSocket gateway (Socket.IO, namespace `/notifications`) — push уведомления в реальном времени
- Планировщик очистки старых уведомлений

#### SttModule
- WebSocket gateway для стриминга аудио и получения транскрипции в реальном времени
- Интеграция с STT Gateway микросервисом

#### LlmPromptTemplatesModule
- Личные и проектные шаблоны промптов
- Системные шаблоны с возможностью скрытия
- Управление порядком (reorder) и агрегированный список `available`

#### ProjectTemplatesModule
- Шаблоны публикаций на уровне проекта
- CRUD + reorder

#### PublicationRelationsModule
- Группы связей публикаций: `SERIES` (серия), `LOCALIZATION` (локализация)
- Link / unlink / create-related / reorder

#### TranslateModule
- Перевод текста через Translation Gateway микросервис
- Поддержка нескольких провайдеров (anylang, google, deepl и др.)

#### TagsModule
- Поиск тегов по скоупу проекта или пользователя

#### PermissionsModule
- Проверка прав доступа к проектам
- Проверка ролей пользователей
- Централизованная логика авторизации

#### SocialPostingModule (Scheduler)
- Автоматическая публикация постов по расписанию
- Определение "эффективного времени" публикации (`Post.scheduledAt ?? Publication.scheduledAt`)
- Механизм устаревания (`EXPIRED`) для постов вне окна обработки
- Атомарные обновления статусов для предотвращения race conditions
- Таймауты на обработку запросов к внешним API

### Фоновые задачи (Background Worker)

Для выполнения ресурсоемких задач и интеграции с внешними микросервисами используется паттерн вынесения работы в фоновый процесс (Worker). 

**Инструменты:**
- **BullMQ** — поверх Redis, обеспечивает надежные очереди с персистентностью, ретраями и обработкой stalled задач.
- **worker.ts** — отдельная точка входа, инициализирующая контекст приложения NestJS без поднятия HTTP-сервера.

**Процесс публикации:**
1. API (или планировщик) меняет статус публикации на `PROCESSING` и подготавливает payload.
2. Задача помещается в очередь `publications` (BullMQ).
3. Фоновый Worker подхватывает задачу. Реализован graceful shutdown — при остановке контейнера воркер завершает текущие задачи или откладывает их, прежде чем выйти.
4. Воркер делает HTTP-запрос в микросервис постинга с поддержкой Retry.
5. После успешного или неудачного выполнения Worker обновляет статусы и запускает проверку всей публикации. Если все посты завершены — пользователю отправляется уведомление (WebSocket + DB).

### Guards и аутентификация

```
Request → JwtOrApiTokenGuard → RolesGuard → Controller
            │                      │
            ▼                      ▼
    JWT Strategy          Check user role
    API Token Guard       in project
            │                      │
            ▼                      ▼
    Validate token        Allow/Deny access
    Extract user info
```

**JwtOrApiTokenGuard:**
- Проверяет наличие JWT токена или API токена
- Извлекает информацию о пользователе
- Добавляет `user` в request

**RolesGuard:**
- Проверяет роль пользователя в проекте
- Используется с декоратором `@Roles('ADMIN', 'OWNER')`

### Обработка ошибок

```typescript
// AllExceptionsFilter - глобальный обработчик
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Логирование
    // Форматирование ответа
    // Отправка клиенту
  }
}
```

**Типы ошибок:**
- `HttpException` - HTTP ошибки (400, 401, 403, 404, и т.д.)
- `PrismaClientKnownRequestError` - ошибки БД
- `UnauthorizedException` - ошибки авторизации
- Прочие исключения

### Логирование

Используется **Pino** для структурированного логирования:

```typescript
// Development: pino-pretty (цветной вывод)
// Production: JSON формат

logger.log('User created', { userId, telegramId });
logger.error('Failed to publish post', { postId, error });
logger.warn('API token expired', { tokenId });
```

**Особенности:**
- Redaction чувствительных данных (токены, пароли)
- Автоматическое логирование HTTP запросов
- Игнорирование health checks в продакшн
- Уровни логирования по HTTP статусам

## Frontend архитектура

### Технологический стек

- **Nuxt 4** - Vue.js фреймворк
- **Vue 3** - Composition API
- **Nuxt UI 4** - компонентная библиотека
- **Pinia** - state management
- **TipTap** - rich-text редактор
- **@tma.js/sdk-vue** - Telegram Mini Apps SDK
- **@nuxtjs/i18n** - интернационализация
- **Tailwind CSS 4** - utility-first CSS

### Структура приложения

```
ui/
├── app/
│   ├── components/              # Vue компоненты
│   │   ├── channels/            # Компоненты каналов
│   │   │   ├── ChannelsList.vue
│   │   │   └── ChannelForm.vue
│   │   ├── posts/               # Компоненты постов
│   │   │   ├── PostsList.vue
│   │   │   └── PostForm.vue
│   │   ├── projects/            # Компоненты проектов
│   │   │   ├── ProjectListItem.vue
│   │   │   └── InviteMemberModal.vue
│   │   └── ui/                  # UI компоненты
│   │       ├── ConfirmModal.vue
│   │       └── RichTextEditor.vue
│   │
│   ├── composables/             # Composables (логика)
│   │   ├── useAuth.ts           # Аутентификация
│   │   ├── useProjects.ts       # Работа с проектами
│   │   ├── useChannels.ts       # Работа с каналами
│   │   ├── usePosts.ts          # Работа с постами
│   │   ├── usePublications.ts   # Работа с публикациями
│   │   ├── useArchive.ts        # Работа с архивом
│   │   └── useTelegram.ts       # Telegram WebApp API
│   │
│   ├── layouts/                 # Layouts
│   │   └── default.vue          # Основной layout
│   │
│   ├── pages/                   # Страницы (роутинг)
│   │   ├── index.vue            # Dashboard
│   │   ├── login.vue            # Страница входа
│   │   ├── settings.vue         # Настройки
│   │   ├── admin/
│   │   │   └── index.vue        # Админ панель
│   │   ├── projects/
│   │   │   ├── index.vue        # Список проектов
│   │   │   └── [id].vue         # Детали проекта
│   │   ├── channels/
│   │   │   ├── index.vue        # Список каналов
│   │   │   └── [channelId].vue  # Детали канала
│   │   ├── publications/
│   │   │   ├── index.vue        # Список публикаций
│   │   │   └── [id].vue         # Редактирование публикации
│   │   └── posts/
│   │       ├── index.vue        # Список постов
│   │       └── [id].vue         # Редактирование поста
│   │
│   ├── stores/                  # Pinia stores
│   │   ├── auth.ts              # Состояние аутентификации
│   │   ├── projects.ts          # Состояние проектов
│   │   ├── channels.ts          # Состояние каналов
│   │   └── ui.ts                # UI состояние
│   │
│   ├── types/                   # TypeScript типы
│   │   └── database.types.ts    # Типы из БД
│   │
│   ├── utils/                   # Утилиты
│   │   ├── api.ts               # API клиент
│   │   └── date.ts              # Работа с датами
│   │
│   └── app.vue                  # Корневой компонент
│
├── assets/
│   └── css/
│       └── main.css             # Глобальные стили
│
├── locales/                     # i18n переводы
│   ├── en-US.json
│   └── ru-RU.json
│
├── public/                      # Статические файлы
│   └── favicon.ico
│
└── nuxt.config.ts               # Конфигурация Nuxt
```

### Архитектурные паттерны

#### 1. Composition API

Вся логика построена на Composition API:

```vue
<script setup lang="ts">
const { projects, loading, fetchProjects } = useProjects();
const { user } = useAuth();

onMounted(async () => {
  await fetchProjects();
});
</script>
```

#### 2. Composables для бизнес-логики

Переиспользуемая логика вынесена в composables:

```typescript
// composables/useProjects.ts
export function useProjects() {
  const projects = ref<Project[]>([]);
  const loading = ref(false);

  async function fetchProjects() {
    loading.value = true;
    try {
      const response = await $fetch('/api/v1/projects');
      projects.value = response;
    } finally {
      loading.value = false;
    }
  }

  return { projects, loading, fetchProjects };
}
```

#### 3. Pinia для глобального состояния

```typescript
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);

  function setUser(newUser: User) {
    user.value = newUser;
  }

  return { user, token, setUser };
});
```

#### 4. Auto-imports

Nuxt автоматически импортирует:
- Компоненты из `components/`
- Composables из `composables/`
- Утилиты из `utils/`

### Роутинг

Файловая система определяет роуты:

```
pages/
├── index.vue                    → /
├── login.vue                    → /login
├── projects/
│   ├── index.vue                → /projects
│   └── [id].vue                 → /projects/:id
└── posts/
    └── [id].vue                 → /posts/:id
```

### State Management

**Локальное состояние:**
- `ref()`, `reactive()` для компонентов
- Composables для переиспользуемой логики

**Глобальное состояние (Pinia):**
- `authStore` - аутентификация и пользователь
- `projectsStore` - текущий проект и список
- `uiStore` - UI состояние (модалки, уведомления)

### API клиент

```typescript
// utils/api.ts
export const apiClient = {
  async get(url: string) {
    return $fetch(url, {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    });
  },
  // post, patch, delete...
};
```

### Telegram Mini App интеграция

```typescript
// composables/useTelegram.ts
export function useTelegram() {
  const webApp = ref<WebApp | null>(null);

  onMounted(() => {
    if (window.Telegram?.WebApp) {
      webApp.value = window.Telegram.WebApp;
      webApp.value.ready();
      webApp.value.expand();
    }
  });

  function getInitData() {
    return webApp.value?.initData || '';
  }

  return { webApp, getInitData };
}
```

## Интеграции

### n8n (Автоматизация рабочих процессов)

В репозитории содержится официальная нода для n8n (`n8n-nodes-bozonx-gran-publicador`), которая позволяет автоматизировать создание контента:

1. **Аутентификация**: Использует API токены для доступа к бэкенду.
2. **Возможности**:
   - Создание публикаций (черновики, готовые)
   - Создание связанных постов
   - Поддержка различных типов контента (текст, медиа)
3. **Использование**: Нода может быть интегрирована в любой n8n workflow для автоматического наполнения системы контентом из RSS, других соцсетей или CRM.

## База данных

### Схема данных

```
User (Пользователи)
  ├── id: UUID
  ├── telegramId: BigInt (unique)
  ├── fullName: String
  ├── telegramUsername: String
  ├── avatarUrl: String
  ├── isAdmin: Boolean
  └── preferences: JSON

Project (Проекты)
  ├── id: UUID
  ├── name: String
  ├── description: String
  ├── ownerId: UUID → User
  ├── archivedAt: DateTime?
  └── archivedBy: UUID?

ProjectMember (Участники проектов)
  ├── id: UUID
  ├── projectId: UUID → Project
  ├── userId: UUID → User
  └── role: ProjectRole (OWNER, ADMIN, EDITOR, VIEWER)

Channel (Каналы)
  ├── id: UUID
  ├── projectId: UUID → Project
  ├── socialMedia: SocialMedia
  ├── name: String
  ├── channelIdentifier: String
  ├── credentials: JSON
  ├── isActive: Boolean
  ├── archivedAt: DateTime?
  └── archivedBy: UUID?

Publication (Публикации)
  ├── id: UUID
  ├── projectId: UUID → Project
  ├── createdBy: UUID → User
  ├── title: String
  ├── description: String
  ├── content: String
  ├── authorComment: String
  ├── tags: String
  ├── status: PublicationStatus
  ├── archivedAt: DateTime?
  └── archivedBy: DateTime?

Media (Медиафайлы)
  ├── id: UUID
  ├── type: MediaType
  ├── storageType: StorageType (FS, TELEGRAM)
  ├── storagePath: String
  ├── filename: String
  ├── sizeBytes: Int
  └── meta: JSON (Метаданные: { width, height, format, orientation, capturedAt, location: { lat, lng } })

Post (Посты)
  ├── id: UUID
  ├── publicationId: UUID → Publication
  ├── channelId: UUID → Channel
  ├── socialMedia: String
  ├── status: PostStatus
  ├── scheduledAt: DateTime?
  └── publishedAt: DateTime?


ApiToken (API токены)
  ├── id: UUID
  ├── userId: UUID → User
  ├── name: String
  ├── hashedToken: String (unique)
  ├── encryptedToken: String
  ├── scopeProjectIds: JSON
  └── lastUsedAt: DateTime?
```

### Индексы

Для оптимизации запросов созданы индексы:

```prisma
@@index([telegramUsername])           // User
@@index([projectId])                  // Channel
@@index([projectId, status])          // Publication
@@index([projectId, createdAt])       // Publication
@@index([status, scheduledAt])        // Post
@@index([channelId, createdAt])       // Post
@@index([publicationId])              // Post
@@index([userId])                     // ApiToken
```

### Каскадное удаление

```
Project (onDelete: Cascade)
  ├── ProjectMember
  ├── Channel
  │   └── Post
  └── Publication
      └── Post

User (onDelete: Cascade)
  ├── Project (owned)
  ├── ProjectMember
  └── ApiToken

User (onDelete: SetNull)
  ├── Post (author)
  └── Publication (author)
```

### Виртуальное каскадное архивирование

При архивации проекта:
1. Устанавливается `archivedAt` и `archivedBy` для проекта
2. Автоматически архивируются все каналы проекта
3. Автоматически архивируются все публикации проекта
4. Автоматически архивируются все посты проекта

Это позволяет восстановить всю структуру одной операцией.

### Транзакции

Критические операции выполняются в транзакциях:

```typescript
await this.prisma.$transaction(async (tx) => {
  // Создание публикации
  const publication = await tx.publication.create({ ... });
  
  // Создание постов для каналов
  await tx.post.createMany({ ... });
});
```

## Безопасность

### Аутентификация

**Telegram Mini App:**
1. Telegram предоставляет `initData` с подписью
2. Backend проверяет подпись через HMAC-SHA256
3. Извлекается информация о пользователе
4. Генерируется JWT токен (срок действия: 7 дней)

**API токены:**
1. Пользователь создает токен через UI
2. Токен хешируется (SHA-256) для поиска
3. Токен шифруется (AES) для хранения
4. Plaintext токен показывается один раз
5. При запросе: хеш → поиск → расшифровка → проверка

### Авторизация

**Уровни доступа:**

```
Project Roles:
  OWNER   → Полный доступ (удаление проекта)
  ADMIN   → Управление участниками и каналами
  EDITOR  → Создание и редактирование контента
  VIEWER  → Только просмотр
```

**Проверка прав:**

```typescript
// В сервисе
async checkAccess(projectId: string, userId: string, minRole: ProjectRole) {
  const member = await this.prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } }
  });
  
  if (!member || !hasRequiredRole(member.role, minRole)) {
    throw new ForbiddenException();
  }
}
```

### Защита данных

**Валидация:**
- DTO валидация через `class-validator`
- Whitelist: только разрешенные поля
- Transform: преобразование типов

**Sanitization:**
- Очистка HTML в контенте
- Escape специальных символов
- Ограничение размера файлов

**Rate limiting:**
- Ограничение запросов (будущая функция)
- Защита от brute-force

### Логирование безопасности

```typescript
// Redaction чувствительных данных
redact: {
  paths: [
    'req.headers.authorization',
    'req.headers["x-api-key"]'
  ],
  censor: '[REDACTED]'
}
```

## Паттерны и практики

### Backend паттерны

#### 1. Dependency Injection

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}
}
```

#### 2. DTO Pattern

```typescript
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  public name!: string;

  @IsString()
  @IsOptional()
  public description?: string;
}
```

#### 3. Repository Pattern (через Prisma)

```typescript
// Prisma как репозиторий
await this.prisma.project.findMany({ where: { ... } });
```

#### 4. Service Layer Pattern

Вся бизнес-логика в сервисах, контроллеры только маршрутизация.

#### 5. Guard Pattern

```typescript
@UseGuards(JwtOrApiTokenGuard, RolesGuard)
@Roles('ADMIN', 'OWNER')
```

### Frontend паттерны

#### 1. Composables Pattern

```typescript
export function useResource() {
  const data = ref([]);
  const loading = ref(false);
  
  async function fetch() { ... }
  async function create() { ... }
  
  return { data, loading, fetch, create };
}
```

#### 2. Store Pattern (Pinia)

```typescript
export const useStore = defineStore('name', () => {
  const state = ref(initialState);
  
  function action() { ... }
  
  return { state, action };
});
```

#### 3. Component Composition

Маленькие переиспользуемые компоненты.

### Общие практики

#### 1. TypeScript Strict Mode

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true
}
```

#### 2. Error Handling

```typescript
try {
  await operation();
} catch (error) {
  logger.error('Operation failed', { error });
  throw new InternalServerErrorException('Operation failed');
}
```

#### 3. Async/Await

Везде используется async/await вместо callbacks.

#### 4. Immutability

```typescript
// Spread operator для обновления
const updated = { ...original, field: newValue };
```

## Масштабируемость

### Текущая архитектура

**Монолит:**
- Один процесс для backend (NestJS + Fastify)
- PostgreSQL — основная БД
- Redis — кеш и pub/sub
- Подходит для малых и средних нагрузок

### Пути масштабирования

#### 1. Вертикальное масштабирование

- Увеличение ресурсов сервера (CPU, RAM)
- Оптимизация запросов к БД
- Расширение кеширования через Redis

#### 2. Горизонтальное масштабирование

**Backend:**
- Несколько инстансов за load balancer
- Shared session store (Redis, уже используется)
- Sticky sessions или JWT (stateless, уже реализовано)

**Frontend:**
- CDN для статики
- Кеширование на уровне CDN

#### 3. База данных

**Текущая:** PostgreSQL
- Read replicas для чтения
- Sharding по проектам (при необходимости)


### Мониторинг

**Логи:**
- Структурированное логирование (Pino)
- Централизованный сбор логов

**Метрики:**
- Время ответа API
- Количество запросов
- Ошибки и исключения

**Алерты:**
- Критические ошибки
- Высокая нагрузка
- Падение сервисов

---

**См. также:**
- [README.md](../README.md) - Общая информация
- [API.md](API.md) - Документация API
- [CONFIGURATION.md](CONFIGURATION.md) - Конфигурация
- [DEPLOYMENT.md](DEPLOYMENT.md) - Развертывание
