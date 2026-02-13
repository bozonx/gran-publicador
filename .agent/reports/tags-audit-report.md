# Аудит функциональности тегов: ContentItem, Publication, Post

**Дата:** 2025-02-13

## Обзор архитектуры

Теги реализованы через отдельную модель `Tag` с many-to-many связями к `ContentItem`, `Publication`, `Post`. Тег принадлежит либо проекту (`projectId`), либо пользователю (`userId`). Уникальность обеспечивается по `(projectId, normalizedName)` и `(userId, normalizedName)`.

---

## Критические проблемы

### 1. [CRITICAL] Бэкенд не нормализует `tagObjects` → `tags` в ответах list/findOne для Publications

**Файлы:** `publications.service.ts:688-695`, `publications.service.ts:800-807`, `publications.service.ts:895-901`, `publications.service.ts:1242-1245`

Методы `findAll`, `findAllForUser`, `findOne`, `update` возвращают `tagObjects` как есть (массив объектов `{id, name, normalizedName, ...}`), **не преобразуя** их в плоский массив `tags: string[]`.

Только метод `copyToProject` (строка 1842) делает нормализацию:
```ts
tags: (newPublication.tagObjects ?? []).map(t => t.name).filter(Boolean)
```

**Последствие:** Фронтенд вынужден обрабатывать оба формата в `resolvePublicationTags()` (`usePublications.ts:35-51`), что является workaround, а не решением. API возвращает несогласованные данные.

### 2. [CRITICAL] Фильтрация ContentItem по тегам использует `name` вместо `normalizedName`

**Файл:** `content-library.service.ts:289-291`
```ts
where.tagObjects = { some: { name: { in: query.tags } } };
```

Фильтрация по `name` — **case-sensitive**. Если пользователь ввёл тег "React", а в фильтре передал "react", совпадения не будет. В `PublicationQueryBuilder` (строка 163) используется `normalizedName` с `.toLowerCase()` — это правильно. ContentItem должен делать то же самое.

### 3. [CRITICAL] Поиск ContentItem по тегам в `search` тоже case-sensitive

**Файл:** `content-library.service.ts:298-300`
```ts
{ tagObjects: { some: { name: { in: tagTokens } } } }
```

Та же проблема — `name` вместо `normalizedName`.

---

## Серьёзные проблемы

### 4. [HIGH] Скрипт миграции `migrate-tags.ts` использует несуществующие unique-индексы

**Файл:** `scripts/migrate-tags.ts:55-56, 98, 134`

Скрипт использует `projectId_name` и `userId_name`:
```ts
where: { projectId_name: { projectId: item.projectId, name } }
```

Но в схеме Prisma уникальные индексы определены как `projectId_normalizedName` и `userId_normalizedName`. Скрипт **не будет работать** при повторном запуске.

### 5. [HIGH] `TagsFormatter.toArray()` принимает только `string`, но получает массив имён

**Файл:** `default.formatter.ts:38-49`

```ts
const tagNames = (post as any).tagObjects?.map((t: any) => t?.name).filter(Boolean) ?? ...;
const tagsString = Array.isArray(tagNames) && tagNames.length > 0
    ? tagNames.join(', ')
    : (snapshot.meta?.inputs?.tags ?? null);
if (tagsString) {
    request.tags = TagsFormatter.toArray(tagsString);
}
```

Теги сначала извлекаются как массив, потом склеиваются в строку через `join(', ')`, потом снова разбиваются в `TagsFormatter.toArray()`. Это лишний round-trip, который может сломать теги с запятыми в имени (хотя маловероятно).

### 6. [HIGH] Post DTO не имеет валидации `@ArrayMaxSize` и `@MaxLength` для тегов

**Файлы:** `create-post.dto.ts:31-34`, `update-post.dto.ts:9-12`

```ts
@IsArray()
@IsString({ each: true })
@IsOptional()
public tags?: string[];
```

В отличие от `CreatePublicationDto` и `CreateContentItemDto`, где есть `@ArrayMaxSize(MAX_TAGS_COUNT)` и `@MaxLength(MAX_TAG_LENGTH, { each: true })`, Post DTO **не ограничивает** количество и длину тегов. Это позволяет отправить неограниченное количество тегов произвольной длины.

### 7. [HIGH] `PostEditBlock.vue` отправляет `tags: null` вместо `tags: []` для очистки тегов

**Файл:** `PostEditBlock.vue:235, 256`

```ts
tags: formData.tags.length > 0 ? formData.tags : null,
```

На бэкенде `posts.service.ts:624-631`:
```ts
tagObjects: data.tags !== undefined
    ? await this.tagsService.prepareTagsConnectOrCreate(normalizeTags(data.tags), ...)
    : undefined,
```

Когда `tags: null`, `normalizeTags(null)` вызовется и вернёт `[]` (через `(tags ?? []).map(...)`), что приведёт к `{ set: [] }` — корректная очистка. **Но** это работает случайно, потому что `normalizeTags` принимает `string[]`, а не `null`. TypeScript-типы нарушены.

---

## Средние проблемы

### 8. [MEDIUM] `SearchTagsQueryDto.limit` не имеет валидации типа

**Файл:** `search-tags-query.dto.ts:17-18`

```ts
@IsOptional()
limit?: number;
```

Нет `@Type(() => Number)`, `@IsInt()`, `@Min()`, `@Max()`. Query-параметры приходят как строки, без `@Type(() => Number)` значение останется строкой. Сервис делает `Number(limit) || 20`, что спасает, но это не идиоматично.

### 9. [MEDIUM] Дублирование валидации scope в контроллере и сервисе

**Файлы:** `tags.controller.ts:19-23`, `tags.service.ts:14-16`

Одна и та же проверка `hasProjectId === hasUserId` выполняется и в контроллере, и в сервисе. Достаточно одного места (контроллер для HTTP, сервис для внутренних вызовов).

### 10. [MEDIUM] Несогласованность: Publications list не возвращает `tags`, а `findOne` тоже нет

Бэкенд `findAll`/`findAllForUser` возвращают объекты с `tagObjects: [{id, name, ...}]`, но **не** с `tags: string[]`. Метод `findOne` тоже не нормализует. Только `copyToProject` нормализует.

Фронтенд `usePublications.ts` компенсирует это через `resolvePublicationTags()`, проверяя сначала `tags` (массив строк), потом `tags` (строка), потом `tagObjects`. Это хрупкая логика.

### 11. [MEDIUM] Channel.tags — устаревшее строковое поле, не связанное с Tag model

**Файл:** `schema.prisma:236`

```prisma
tags String?
```

Модель `Channel` имеет поле `tags` типа `String?`, которое **не связано** с моделью `Tag`. Это legacy-поле, которое не мигрировано на новую систему тегов. Оно используется для "навигации и ориентации публикаций", но не интегрировано с Tag-системой.

### 12. [MEDIUM] `prepareTagsConnectOrCreate` при `isUpdate=false` и пустом массиве возвращает `undefined`

**Файл:** `tags.service.ts:51`

```ts
if (!tags || tags.length === 0) return isUpdate ? { set: [] } : undefined;
```

При создании с пустым массивом тегов возвращается `undefined`, что корректно для Prisma (не трогает связь). Но при создании с `tags: []` (явно пустой массив) семантически пользователь хочет "без тегов", а `undefined` означает "не менять". Для create это одно и то же, но неочевидно.

---

## Незначительные проблемы

### 13. [LOW] `as any` кастинг для tagObjects в social-posting

**Файлы:** `default.formatter.ts:39-40`, `post-snapshot-builder.service.ts:64, 69`, `publications.service.ts:1805-1807`

Повсеместное использование `(post as any).tagObjects` и `(publication as any).tagObjects` указывает на то, что типы Prisma не включают `tagObjects` в include-типизацию. Нужно правильно типизировать include-результаты.

### 14. [LOW] `CommonTags.vue` использует `parseTags` для нормализации, но получает уже нормализованный массив

**Файл:** `CommonTags.vue:25-27`

```ts
const normalizedTags = computed(() => {
  return parseTags(props.tags)
})
```

`parseTags` принимает `TagsInput = string | string[] | null | undefined`. Когда `tags` уже массив строк, `parseTags` просто делает `.map(t => String(t).trim()).filter(Boolean)` — лишняя работа, но не баг.

### 15. [LOW] Нет API для удаления/переименования тегов

Текущий API (`GET /tags/search`) позволяет только искать теги. Нет эндпоинтов для:
- Удаления тега (и отвязки от всех сущностей)
- Переименования тега
- Слияния дублирующих тегов
- Просмотра всех тегов проекта/пользователя

### 16. [LOW] Нет каскадного удаления осиротевших тегов

Когда все сущности отвязываются от тега (через `set: []` при обновлении), тег остаётся в таблице `tags` без связей. Со временем накапливаются "мёртвые" теги.

---

## Сводная таблица

| # | Уровень | Область | Краткое описание |
|---|---------|---------|------------------|
| 1 | CRITICAL | Backend API | Несогласованная нормализация tagObjects→tags в ответах |
| 2 | CRITICAL | Backend | ContentItem фильтрация по `name` вместо `normalizedName` |
| 3 | CRITICAL | Backend | ContentItem поиск по тегам case-sensitive |
| 4 | HIGH | Scripts | Миграция использует несуществующие unique-индексы |
| 5 | HIGH | Backend | Лишний round-trip string↔array в TagsFormatter |
| 6 | HIGH | Backend DTO | Post DTO без валидации размера/длины тегов |
| 7 | HIGH | Frontend | `tags: null` вместо `tags: []` нарушает TypeScript-типы |
| 8 | MEDIUM | Backend DTO | SearchTagsQueryDto.limit без валидации типа |
| 9 | MEDIUM | Backend | Дублирование валидации scope |
| 10 | MEDIUM | Backend API | Несогласованность формата тегов между эндпоинтами |
| 11 | MEDIUM | Schema | Channel.tags — legacy строковое поле |
| 12 | MEDIUM | Backend | Неочевидная семантика пустого массива при создании |
| 13 | LOW | Backend | `as any` кастинг для tagObjects |
| 14 | LOW | Frontend | Лишняя нормализация в CommonTags.vue |
| 15 | LOW | API | Нет CRUD для управления тегами |
| 16 | LOW | Backend | Нет очистки осиротевших тегов |

---

## Рекомендации по приоритету исправлений

1. **Исправить case-sensitive фильтрацию** в content-library (проблемы #2, #3) — использовать `normalizedName` с `.toLowerCase()`
2. **Унифицировать API-ответы** — добавить нормализацию `tagObjects → tags` во все методы publications.service (проблема #1, #10)
3. **Добавить валидацию** в Post DTO (проблема #6)
4. **Исправить миграционный скрипт** (проблема #4) — использовать `projectId_normalizedName`
5. **Добавить валидацию limit** в SearchTagsQueryDto (проблема #8)
6. **Рассмотреть** добавление CRUD для тегов и очистку осиротевших (проблемы #15, #16)
