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

Gran Publicador построен по принципу **монолитной архитектуры** с разделением на Backend (NestJS) и Frontend (Nuxt), работающих как единое приложение.

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
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Backend (NestJS + Fastify)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Controllers  │  Services  │  Guards  │  Filters │   │
│  └──────────────────────────────────────────────────┘   │
│                    REST API (/api/v1/*)                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Prisma ORM
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Database (SQLite)                      │
│              gran-publicador.db (в DATA_DIR/db)         │
└─────────────────────────────────────────────────────────┘
```

### Ключевые принципы

1. **Монолит с модульной структурой** - единое приложение, но четко разделенное на модули
2. **API-first подход** - все взаимодействие через REST API
3. **Типобезопасность** - TypeScript на всех уровнях
4. **Конфигурация как код** - YAML конфигурация с hot-reload
5. **Безопасность по умолчанию** - все эндпоинты защищены

## Backend архитектура

### Технологический стек

- **NestJS 11** - модульный фреймворк
- **Fastify** - HTTP сервер (быстрее Express)
- **Prisma 7** - ORM с типобезопасностью
- **SQLite** - встроенная БД
- **Passport + JWT** - аутентификация
- **Pino** - структурированное логирование
- **class-validator** - валидация DTO

### Структура модулей

```
src/
├── common/                      # Общие компоненты
│   ├── constants/               # Константы приложения
│   │   └── auth.constants.ts    # JWT стратегии, роли
│   ├── decorators/              # Кастомные декораторы
│   │   └── roles.decorator.ts   # @Roles('ADMIN')
│   ├── filters/                 # Exception filters
│   │   ├── all-exceptions.filter.ts    # Глобальный обработчик ошибок
│   │   └── spa-fallback.filter.ts      # SPA fallback для 404
│   ├── guards/                  # Guards для защиты эндпоинтов
│   │   ├── jwt-or-api-token.guard.ts   # JWT или API токен
│   │   ├── jwt-auth.guard.ts           # Только JWT
│   │   └── roles.guard.ts              # Проверка ролей
│   ├── pipes/                   # Validation pipes
│   ├── services/                # Общие сервисы
│   │   └── permissions.service.ts      # Проверка прав доступа
│   └── types/                   # Общие типы
│       └── unified-auth-request.interface.ts
│
├── config/                      # Конфигурация
│   ├── app.config.ts            # Основная конфигурация
│   └── database.config.ts       # Конфигурация БД
│
├── modules/                     # Бизнес-модули
│   ├── api-tokens/              # API токены
│   │   ├── dto/
│   │   ├── api-tokens.controller.ts
│   │   ├── api-tokens.service.ts
│   │   └── api-tokens.module.ts
│   │
│   ├── archive/                 # Система архивирования
│   │   ├── archive.controller.ts
│   │   ├── archive.service.ts
│   │   └── archive.module.ts
│   │
│   ├── auth/                    # Аутентификация
│   │   ├── dto/
│   │   ├── guards/
│   │   │   └── api-token.guard.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── channels/                # Управление каналами
│   │   ├── dto/
│   │   ├── channels.controller.ts
│   │   ├── channels.service.ts
│   │   └── channels.module.ts
│   │
│   ├── health/                  # Health check
│   │   ├── health.controller.ts
│   │   └── health.module.ts
│   │
│   ├── posts/                   # Управление постами
│   │   ├── dto/
│   │   ├── posts.controller.ts
│   │   ├── posts.service.ts
│   │   └── posts.module.ts
│   │
│   ├── prisma/                  # Prisma сервис
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── projects/                # Управление проектами
│   │   ├── dto/
│   │   ├── projects.controller.ts
│   │   ├── projects.service.ts
│   │   └── projects.module.ts
│   │
│   ├── publications/            # Управление публикациями
│   │   ├── dto/
│   │   ├── publications.controller.ts
│   │   ├── publications.service.ts
│   │   └── publications.module.ts
│   │
│   ├── media/                   # Управление медиафайлами
│   │   ├── dto/
│   │   ├── media.controller.ts
│   │   ├── media.service.ts
│   │   └── media.module.ts
│   │
│   └── users/                   # Управление пользователями
│       ├── dto/
│       ├── users.controller.ts
│       ├── users.service.ts
│       └── users.module.ts
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

#### SystemConfigModule
- Загрузка конфигурации из YAML
- Hot-reload конфигурации
- Env substitution (${VAR_NAME})
- Валидация конфигурации

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
│   │   │   ├── new.vue          # Создание проекта
│   │   │   └── [id].vue         # Детали проекта
│   │   ├── channels/
│   │   │   ├── index.vue        # Список каналов
│   │   │   └── [channelId].vue  # Детали канала
│   │   ├── publications/
│   │   │   ├── index.vue        # Список публикаций
│   │   │   ├── new.vue          # Создание публикации
│   │   │   └── [id].vue         # Редактирование публикации
│   │   └── posts/
│   │       ├── index.vue        # Список постов
│   │       ├── new.vue          # Создание поста
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
│   ├── new.vue                  → /projects/new
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
  ├── archivedBy: DateTime?
  └── sourceTexts: JSON (Источник материалов: [{ content, order, source? }])

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
#### Вариант 1: Прямая публикация (standalone)
1. Создается пост напрямую для канала.
2. **Автоматическое создание публикации**: Система автоматически создает родительскую публикацию-контейнер для обеспечения целостности данных (все посты должны принадлежать публикации).
3. Указывается контент, медиафайлы, дата публикации.
4. Устанавливается статус `SCHEDULED`.
5. Пост ожидает публикации в соответствии с расписанием.
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
- Один процесс для backend
- Один процесс для frontend (dev)
- SQLite база данных
- Подходит для малых и средних нагрузок

### Пути масштабирования

#### 1. Вертикальное масштабирование

- Увеличение ресурсов сервера (CPU, RAM)
- Оптимизация запросов к БД
- Кеширование (Redis)

#### 2. Горизонтальное масштабирование

**Backend:**
- Несколько инстансов за load balancer
- Shared session store (Redis)
- Миграция на PostgreSQL для concurrent access

**Frontend:**
- CDN для статики
- Кеширование на уровне CDN

#### 3. Микросервисы (будущее)

Возможное разделение:
- Publications Service

#### 4. База данных

**Текущая:** SQLite (файл)

**Миграция:**
- PostgreSQL для продакшн
- Read replicas для чтения
- Sharding по проектам


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
