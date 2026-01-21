# API Token Project Scope Refactoring

## Дата: 2026-01-21

## Описание изменений

Произведен рефакторинг системы API токенов для замены JSON-массива `scopeProjectIds` на полноценную таблицу связей `ApiTokenProject` с флагом `allProjects`.

## Причины изменений

1. **Целостность данных (Referential Integrity)**: Теперь база данных автоматически контролирует связи между токенами и проектами через внешние ключи с каскадным удалением
2. **Производительность**: Поиск и фильтрация через индексированную таблицу связей быстрее, чем через JSON-операторы
3. **Типизация**: Prisma Client теперь генерирует правильные типы для связей
4. **Удобство**: Можно использовать `include` для загрузки связанных проектов одним запросом

## Структура данных

### До изменений
```typescript
model ApiToken {
  scopeProjectIds Json  // JSON массив строк: ["id1", "id2"]
}
```

### После изменений
```typescript
model ApiToken {
  allProjects Boolean   // true = доступ ко всем проектам
  projects    ApiTokenProject[]  // связь many-to-many
}

model ApiTokenProject {
  apiTokenId String
  projectId  String
  apiToken   ApiToken
  project    Project
}
```

## Логика работы

### Полный доступ (allProjects = true)
- Токен имеет доступ ко **всем** проектам пользователя, включая будущие
- Таблица связей `ApiTokenProject` пустая для такого токена
- Используется для административных токенов

### Ограниченный доступ (allProjects = false)
- Токен имеет доступ только к проектам, указанным в таблице `ApiTokenProject`
- Каждая запись в таблице связей = один разрешенный проект
- При удалении проекта связь автоматически удаляется (CASCADE)

## Изменения в API

### DTO (CreateApiTokenDto, UpdateApiTokenDto)
```typescript
// Было:
{
  name: string;
  scopeProjectIds?: string[];  // [] = все проекты
}

// Стало:
{
  name: string;
  allProjects?: boolean;       // true = все проекты
  projectIds?: string[];       // конкретные ID проектов
}
```

### Валидация
- Нельзя одновременно указать `allProjects=true` и `projectIds`
- При `allProjects=false` и пустом `projectIds` токен не имеет доступа ни к одному проекту

## Миграция данных

Миграция `20260121132941_add_api_token_project_relation` автоматически:
1. Создает таблицу `api_token_projects`
2. Для токенов с `scopeProjectIds = []` устанавливает `allProjects = true`
3. Для токенов с непустым массивом создает записи в таблице связей
4. Удаляет старую колонку `scope_project_ids`

## Изменения в коде

### Обновленные файлы
- `prisma/schema.prisma` - новая модель и связи
- `src/modules/api-tokens/dto/api-token.dto.ts` - обновленные DTO
- `src/modules/api-tokens/api-tokens.service.ts` - логика работы с таблицей связей
- `src/common/guards/api-token.guard.ts` - обновленная валидация scope
- `src/common/guards/jwt-or-api-token.guard.ts` - нормализация user объекта
- `src/common/types/api-token-user.interface.ts` - обновленные интерфейсы
- `src/common/types/unified-auth-request.interface.ts` - обновленные интерфейсы
- Все контроллеры (projects, channels, publications, posts) - обновленная проверка доступа

### Проверка доступа в контроллерах

```typescript
// Было:
if (req.user.scopeProjectIds && req.user.scopeProjectIds.length > 0) {
  ApiTokenGuard.validateProjectScope(projectId, req.user.scopeProjectIds, {...});
}

// Стало:
if (req.user.allProjects !== undefined) {
  ApiTokenGuard.validateProjectScope(
    projectId, 
    req.user.allProjects, 
    req.user.projectIds ?? [], 
    {...}
  );
}
```

## Обратная совместимость

⚠️ **Breaking Change**: API изменился, клиенты должны обновить запросы:
- При создании токена использовать `allProjects` и `projectIds` вместо `scopeProjectIds`
- В ответах API теперь возвращается `allProjects` и `projectIds`

## Тестирование

После применения изменений необходимо протестировать:
1. ✅ Создание токена с полным доступом (`allProjects: true`)
2. ✅ Создание токена с ограниченным доступом (`projectIds: ["id1", "id2"]`)
3. ✅ Обновление scope токена
4. ✅ Удаление проекта (связь должна удалиться автоматически)
5. ✅ Проверка доступа через API с разными токенами
6. ✅ Миграция существующих токенов

## Примеры использования

### Создание токена с полным доступом
```bash
POST /api/v1/api-tokens
{
  "name": "Admin Token",
  "allProjects": true
}
```

### Создание токена с ограниченным доступом
```bash
POST /api/v1/api-tokens
{
  "name": "Project-specific Token",
  "projectIds": ["project-uuid-1", "project-uuid-2"]
}
```

### Обновление scope
```bash
PATCH /api/v1/api-tokens/:id
{
  "projectIds": ["project-uuid-3"]  // заменит все существующие связи
}
```
