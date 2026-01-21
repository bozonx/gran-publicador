# Аудит валидации параметров API

**Дата:** 2026-01-21  
**Цель:** Проверка логичности, полноты и безопасности валидации параметров API

---

## 🔴 Критические проблемы

### 1. Отсутствие верхних границ для числовых параметров

#### `GenerateContentDto.max_tokens` (llm/dto/generate-content.dto.ts:39-41)
```typescript
@IsNumber()
@Min(1)
max_tokens?: number;
```
**Проблема:** Нет `@Max()` - пользователь может указать огромное значение (например, 999999999), что приведет к:
- Чрезмерному расходу токенов LLM
- Долгому времени генерации
- Потенциальному DoS

**Рекомендация:** Добавить `@Max(16000)` или другое разумное значение в зависимости от используемых моделей.

---

#### `FindProjectsQueryDto.limit` (projects/dto/find-projects-query.dto.ts:16-18)
```typescript
@IsInt()
@Min(0)
limit?: number;
```
**Проблема:** `@Min(0)` позволяет 0, что бессмысленно для limit. Нет верхней границы.

**Рекомендация:**
- Изменить на `@Min(1)`
- Добавить `@Max(100)` для защиты от чрезмерных запросов

---

#### Все пагинационные `limit` без верхних границ

**Затронутые файлы:**
- `FindPublicationsQueryDto.limit` (publications/dto/find-publications-query.dto.ts:99)
- `FindChannelsQueryDto.limit` (channels/dto/find-channels-query.dto.ts:83)
- `NotificationFilterDto.limit` (notifications/dto/notification-filter.dto.ts:17)

**Проблема:** Отсутствие `@Max()` позволяет запросить миллионы записей, что может:
- Перегрузить базу данных
- Вызвать OutOfMemory
- Замедлить API

**Рекомендация:** Добавить `@Max(100)` или `@Max(1000)` в зависимости от бизнес-требований.

---

### 2. Отсутствие валидации размера массивов

#### `BulkOperationDto.ids` (publications/dto/bulk-operation.dto.ts:12-14)
```typescript
@IsArray()
@IsString({ each: true })
ids!: string[];
```
**Проблема:** Нет `@ArrayMaxSize()` - можно отправить массив с миллионами ID, что приведет к:
- Перегрузке базы данных при массовых операциях
- Долгому времени обработки
- Потенциальному DoS

**Рекомендация:** Добавить `@ArrayMaxSize(1000)` или другое разумное значение.

---

#### `ReorderLlmPromptTemplatesDto.ids` (llm-prompt-templates/dto/reorder-llm-prompt-templates.dto.ts:4-6)
```typescript
@IsArray()
@IsString({ each: true })
ids!: string[];
```
**Проблема:** Аналогично - нет ограничения на размер массива.

**Рекомендация:** Добавить `@ArrayMaxSize(100)`.

---

#### `CreatePublicationDto.channelIds` (publications/dto/create-publication.dto.ts:132-135)
```typescript
@IsArray()
@IsString({ each: true })
@IsOptional()
public channelIds?: string[];
```
**Проблема:** Нет ограничения на количество каналов.

**Рекомендация:** Добавить `@ArrayMaxSize(50)` - разумный лимит для одновременной публикации.

---

#### `CreatePublicationDto.sourceTexts` (publications/dto/create-publication.dto.ts:137-141)
```typescript
@IsArray()
@ValidateNested({ each: true })
@Type(() => SourceTextDto)
@IsOptional()
public sourceTexts?: SourceTextDto[];
```
**Проблема:** Нет ограничения на количество исходных текстов.

**Рекомендация:** Добавить `@ArrayMaxSize(20)`.

---

#### `GenerateContentDto.selectedSourceIndexes` (llm/dto/generate-content.dto.ts:84-87)
```typescript
@IsOptional()
@IsArray()
@IsNumber({}, { each: true })
selectedSourceIndexes?: number[];
```
**Проблема:** Нет ограничения на размер массива индексов.

**Рекомендация:** Добавить `@ArrayMaxSize(100)`.

---

### 3. Отсутствие валидации длины строк

#### `CreateProjectDto.name` (projects/dto/create-project.dto.ts:7-9)
```typescript
@IsString()
@IsNotEmpty()
public name!: string;
```
**Проблема:** Нет `@MaxLength()` - можно отправить строку в мегабайты.

**Рекомендация:** Добавить `@MaxLength(200)`.

---

#### `CreateProjectDto.description` (projects/dto/create-project.dto.ts:11-13)
```typescript
@IsString()
@IsOptional()
public description?: string;
```
**Проблема:** Нет ограничения длины.

**Рекомендация:** Добавить `@MaxLength(2000)`.

---

#### `CreateChannelDto.name` (channels/dto/create-channel.dto.ts:26-28)
```typescript
@IsString()
@IsNotEmpty()
public name!: string;
```
**Проблема:** Нет `@MaxLength()`.

**Рекомендация:** Добавить `@MaxLength(200)`.

---

#### `CreateChannelDto.description` (channels/dto/create-channel.dto.ts:30-32)
```typescript
@IsString()
@IsOptional()
public description?: string;
```
**Проблема:** Нет ограничения длины.

**Рекомендация:** Добавить `@MaxLength(2000)`.

---

#### `CreateChannelDto.channelIdentifier` (channels/dto/create-channel.dto.ts:34-36)
```typescript
@IsString()
@IsNotEmpty()
public channelIdentifier!: string;
```
**Проблема:** Нет ограничения длины для идентификатора канала.

**Рекомендация:** Добавить `@MaxLength(100)`.

---

#### `CreatePublicationDto.title` (publications/dto/create-publication.dto.ts:46-48)
```typescript
@IsString()
@IsOptional()
public title?: string;
```
**Проблема:** Нет ограничения длины заголовка.

**Рекомендация:** Добавить `@MaxLength(500)`.

---

#### `CreatePublicationDto.description` (publications/dto/create-publication.dto.ts:50-52)
```typescript
@IsString()
@IsOptional()
public description?: string;
```
**Проблема:** Нет ограничения длины описания.

**Рекомендация:** Добавить `@MaxLength(2000)`.

---

#### `CreatePublicationDto.content` (publications/dto/create-publication.dto.ts:64-66)
```typescript
@IsString()
@IsOptional()
public content?: string;
```
**Проблема:** Нет ограничения длины контента. Хотя есть валидация на уровне соцсетей, но на уровне DTO нет защиты от огромных строк.

**Рекомендация:** Добавить `@MaxLength(100000)` - разумный максимум для контента.

---

#### `CreatePublicationDto.authorComment` (publications/dto/create-publication.dto.ts:68-70)
```typescript
@IsString()
@IsOptional()
public authorComment?: string;
```
**Проблема:** Нет ограничения длины.

**Рекомендация:** Добавить `@MaxLength(5000)`.

---

#### `CreatePublicationDto.note` (publications/dto/create-publication.dto.ts:72-74)
```typescript
@IsString()
@IsOptional()
public note?: string;
```
**Проблема:** Нет ограничения длины.

**Рекомендация:** Добавить `@MaxLength(5000)`.

---

#### `CreatePublicationDto.tags` (publications/dto/create-publication.dto.ts:88-90)
```typescript
@IsString()
@IsOptional()
public tags?: string;
```
**Проблема:** Нет ограничения длины тегов.

**Рекомендация:** Добавить `@MaxLength(1000)`.

---

#### `GenerateContentDto.prompt` (llm/dto/generate-content.dto.ts:21-23)
```typescript
@IsString()
@IsNotEmpty()
prompt!: string;
```
**Проблема:** Нет ограничения длины промпта.

**Рекомендация:** Добавить `@MaxLength(50000)` - в зависимости от лимитов LLM.

---

#### `GenerateContentDto.content` (llm/dto/generate-content.dto.ts:61-63)
```typescript
@IsOptional()
@IsString()
content?: string;
```
**Проблема:** Нет ограничения длины контента для контекста.

**Рекомендация:** Добавить `@MaxLength(100000)`.

---

#### `SourceTextDto.content` (llm/dto/generate-content.dto.ts:94-96)
```typescript
@IsString()
@IsNotEmpty()
content!: string;
```
**Проблема:** Нет ограничения длины исходного текста.

**Рекомендация:** Добавить `@MaxLength(50000)`.

---

#### `CreateLlmPromptTemplateDto.name` (llm-prompt-templates/dto/create-llm-prompt-template.dto.ts:4-6)
```typescript
@IsString()
@IsNotEmpty()
name!: string;
```
**Проблема:** Нет ограничения длины имени шаблона.

**Рекомендация:** Добавить `@MaxLength(200)`.

---

#### `CreateLlmPromptTemplateDto.description` (llm-prompt-templates/dto/create-llm-prompt-template.dto.ts:8-10)
```typescript
@IsString()
@IsOptional()
description?: string;
```
**Проблема:** Нет ограничения длины описания.

**Рекомендация:** Добавить `@MaxLength(2000)`.

---

#### `CreateLlmPromptTemplateDto.prompt` (llm-prompt-templates/dto/create-llm-prompt-template.dto.ts:12-14)
```typescript
@IsString()
@IsNotEmpty()
prompt!: string;
```
**Проблема:** Нет ограничения длины промпта.

**Рекомендация:** Добавить `@MaxLength(50000)`.

---

#### `CreateMediaDto.filename` (media/dto/create-media.dto.ts:16-18)
```typescript
@IsString()
@IsOptional()
filename?: string;
```
**Проблема:** Нет ограничения длины имени файла.

**Рекомендация:** Добавить `@MaxLength(255)` - стандартный лимит файловых систем.

---

#### `CreateMediaDto.alt` (media/dto/create-media.dto.ts:20-22)
```typescript
@IsString()
@IsOptional()
alt?: string;
```
**Проблема:** Нет ограничения длины alt-текста.

**Рекомендация:** Добавить `@MaxLength(500)`.

---

#### `CreateMediaDto.description` (media/dto/create-media.dto.ts:24-26)
```typescript
@IsString()
@IsOptional()
description?: string;
```
**Проблема:** Нет ограничения длины описания медиа.

**Рекомендация:** Добавить `@MaxLength(2000)`.

---

#### `TranslateTextDto.text` (translate/dto/translate-text.dto.ts:10-12)
```typescript
@IsString()
@IsNotEmpty()
text!: string;
```
**Проблема:** Нет ограничения длины текста для перевода на уровне DTO. Есть `maxTextLength` как параметр, но нет жесткого лимита.

**Рекомендация:** Добавить `@MaxLength(1000000)` для защиты от злоупотреблений.

---

#### `TelegramWidgetLoginDto.first_name` (auth/dto/telegram-widget-login.dto.ts:11-13)
```typescript
@IsString()
@IsNotEmpty()
public first_name!: string;
```
**Проблема:** Нет ограничения длины имени.

**Рекомендация:** Добавить `@MaxLength(100)`.

---

#### `TelegramWidgetLoginDto.last_name` (auth/dto/telegram-widget-login.dto.ts:15-17)
```typescript
@IsString()
@IsOptional()
public last_name?: string;
```
**Проблема:** Нет ограничения длины фамилии.

**Рекомендация:** Добавить `@MaxLength(100)`.

---

#### `TelegramWidgetLoginDto.username` (auth/dto/telegram-widget-login.dto.ts:19-21)
```typescript
@IsString()
@IsOptional()
public username?: string;
```
**Проблема:** Нет ограничения длины username.

**Рекомендация:** Добавить `@MaxLength(100)`.

---

#### `TelegramWidgetLoginDto.photo_url` (auth/dto/telegram-widget-login.dto.ts:23-25)
```typescript
@IsString()
@IsOptional()
public photo_url?: string;
```
**Проблема:** Нет валидации URL и ограничения длины.

**Рекомендация:** Добавить `@IsUrl()` и `@MaxLength(2000)`.

---

#### `AddMemberDto.username` (projects/dto/add-member.dto.ts:5-7)
```typescript
@IsString()
@IsNotEmpty()
public username!: string;
```
**Проблема:** Нет ограничения длины username.

**Рекомендация:** Добавить `@MaxLength(100)`.

---

#### `ApiTokenDto.name` (api-tokens/dto/api-token.dto.ts:5-6)
```typescript
@IsString()
public name!: string;
```
**Проблема:** Нет ограничения длины имени токена.

**Рекомендация:** Добавить `@MaxLength(200)`.

---

### 4. Отсутствие валидации типа для `sizeBytes`

#### `CreateMediaDto.sizeBytes` (media/dto/create-media.dto.ts:32-34)
```typescript
@IsOptional()
@Transform(({ value }) => (value !== null && value !== undefined ? BigInt(value) : value))
sizeBytes?: bigint;
```
**Проблема:** Нет валидации на `@IsNumber()` или `@Min()`. Можно передать отрицательное значение или некорректные данные.

**Рекомендация:** Добавить валидацию перед трансформацией или использовать кастомный валидатор для bigint.

---

### 5. Отсутствие валидации для `order` в массивах

#### `ReorderMediaDto.MediaOrderItem.order` (publications/dto/reorder-media.dto.ts:8-9)
```typescript
@IsNumber()
order!: number;
```
**Проблема:** Нет `@IsInt()` и `@Min(0)` - можно передать дробные или отрицательные числа.

**Рекомендация:** Добавить `@IsInt()` и `@Min(0)`.

---

### 6. Отсутствие валидации размера массива media

#### `ReorderMediaDto.media` (publications/dto/reorder-media.dto.ts:12-16)
```typescript
@IsArray()
@ValidateNested({ each: true })
@Type(() => MediaOrderItem)
media!: MediaOrderItem[];
```
**Проблема:** Нет `@ArrayMaxSize()` - можно отправить огромный массив.

**Рекомендация:** Добавить `@ArrayMaxSize(100)`.

---

## 🟡 Средние проблемы

### 7. Непоследовательность в валидации `limit`

**Проблема:** В разных DTO используются разные подходы:
- `FindPublicationsQueryDto.limit`: `@Min(1)` ✅
- `FindChannelsQueryDto.limit`: `@Min(1)` ✅
- `FindProjectsQueryDto.limit`: `@Min(0)` ❌
- `NotificationFilterDto.limit`: `@Min(1)` ✅

**Рекомендация:** Унифицировать - везде использовать `@Min(1)` для limit.

---

### 8. Отсутствие валидации для `meta` и `preferences`

**Затронутые поля:**
- `CreatePublicationDto.meta` (publications/dto/create-publication.dto.ts:102-104)
- `CreateProjectDto.preferences` (projects/dto/create-project.dto.ts:15-17)
- `CreateChannelDto.credentials` (channels/dto/create-channel.dto.ts:43-45)
- `CreateChannelDto.preferences` (channels/dto/create-channel.dto.ts:51-53)

```typescript
@IsObject()
@IsOptional()
public meta?: Record<string, any>;
```

**Проблема:** `@IsObject()` не защищает от:
- Огромных вложенных объектов
- Глубокой вложенности
- Циклических ссылок

**Рекомендация:** 
- Использовать кастомный валидатор для ограничения размера JSON
- Добавить проверку глубины вложенности
- Или использовать `@ValidateNested()` с конкретными DTO

---

### 9. Отсутствие валидации диапазона для `order`

#### `SourceTextDto.order` (publications/dto/create-publication.dto.ts:29-31)
```typescript
@IsNumber()
@IsOptional()
public order?: number;
```
**Проблема:** Нет `@IsInt()` и `@Min(0)` - можно передать дробные или отрицательные числа.

**Рекомендация:** Добавить `@IsInt()` и `@Min(0)`.

---

#### `CreateLlmPromptTemplateDto.order` (llm-prompt-templates/dto/create-llm-prompt-template.dto.ts:16-19)
```typescript
@IsInt()
@Min(0)
@IsOptional()
order?: number;
```
**Проблема:** Нет верхней границы - можно установить order = 999999999.

**Рекомендация:** Добавить `@Max(10000)` или другое разумное значение.

---

### 10. Потенциально избыточные лимиты в TranslateTextDto

#### `TranslateTextDto.maxTextLength` (translate/dto/translate-text.dto.ts:60-62)
```typescript
@IsNumber()
@Min(100)
@Max(10000000)
```
**Проблема:** `@Max(10000000)` (10 миллионов символов) - это ~10MB текста. Слишком большое значение.

**Рекомендация:** Пересмотреть лимит - возможно, `@Max(1000000)` (1 миллион) будет более разумным.

---

### 11. Отсутствие валидации для `selectedSourceIndexes`

#### `GenerateContentDto.selectedSourceIndexes` (llm/dto/generate-content.dto.ts:84-87)
```typescript
@IsOptional()
@IsArray()
@IsNumber({}, { each: true })
selectedSourceIndexes?: number[];
```
**Проблема:** Нет проверки на:
- `@IsInt()` - можно передать дробные числа
- `@Min(0)` - можно передать отрицательные индексы
- Нет проверки, что индексы не превышают размер массива sourceTexts

**Рекомендация:** 
- Добавить `@IsInt({ each: true })`
- Добавить кастомный валидатор для проверки диапазона индексов

---

## 🟢 Хорошие практики (найденные в коде)

### ✅ Правильная валидация в `TranslateTextDto`
- Все числовые параметры имеют `@Min()` и `@Max()`
- Четкие диапазоны значений
- Хорошая документация

### ✅ Правильная валидация в `AuthorSignatureDto`
- `@MaxLength(100)` для name
- `@MaxLength(200)` для content

### ✅ Правильная валидация в `CreatePostsDto`
- `@ArrayMinSize(1)` - обязательно хотя бы один канал
- `@ArrayUnique()` - нет дубликатов
- `@IsUUID('4', { each: true })` - валидация формата UUID

### ✅ Правильная валидация в `AppConfig`
- `@Min(1)` и `@Max(65535)` для порта
- `@MinLength(32)` для JWT_SECRET с понятным сообщением об ошибке
- `@IsIn()` для enum-подобных значений

### ✅ Правильная валидация в `MediaConfig`
- `@IsUrl({ require_tld: false })` для URL микросервисов
- `@Min(1)` и `@Max(100)` для thumbnailQuality

---

## 📋 Рекомендации по приоритетам

### Высокий приоритет (безопасность и DoS)
1. ✅ Добавить `@Max()` для всех `limit` параметров пагинации
2. ✅ Добавить `@ArrayMaxSize()` для всех массивов (особенно `BulkOperationDto.ids`)
3. ✅ Добавить `@Max()` для `GenerateContentDto.max_tokens`
4. ✅ Добавить `@MaxLength()` для всех строковых полей

### Средний приоритет (консистентность)
5. ✅ Унифицировать валидацию `limit` - везде `@Min(1)`
6. ✅ Добавить валидацию для `order` полей (`@IsInt()`, `@Min(0)`, `@Max()`)
7. ✅ Добавить валидацию для `sizeBytes`
8. ✅ Добавить валидацию для `selectedSourceIndexes`

### Низкий приоритет (улучшения)
9. ✅ Рассмотреть валидацию размера JSON для `meta` и `preferences`
10. ✅ Пересмотреть лимиты в `TranslateTextDto.maxTextLength`

---

## 🛠️ Предлагаемые константы

Создать файл `src/common/constants/validation.constants.ts`:

```typescript
export const VALIDATION_LIMITS = {
  // Pagination
  MAX_LIMIT: 100,
  MIN_LIMIT: 1,
  MIN_OFFSET: 0,

  // Arrays
  MAX_BULK_IDS: 1000,
  MAX_CHANNELS_PER_PUBLICATION: 50,
  MAX_SOURCE_TEXTS: 20,
  MAX_MEDIA_ITEMS: 100,
  MAX_SELECTED_INDEXES: 100,
  MAX_REORDER_ITEMS: 100,

  // Strings
  MAX_NAME_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_TITLE_LENGTH: 500,
  MAX_CONTENT_LENGTH: 100000,
  MAX_COMMENT_LENGTH: 5000,
  MAX_NOTE_LENGTH: 5000,
  MAX_TAGS_LENGTH: 1000,
  MAX_FILENAME_LENGTH: 255,
  MAX_ALT_TEXT_LENGTH: 500,
  MAX_URL_LENGTH: 2000,
  MAX_USERNAME_LENGTH: 100,
  MAX_CHANNEL_IDENTIFIER_LENGTH: 100,

  // LLM
  MAX_PROMPT_LENGTH: 50000,
  MAX_LLM_TOKENS: 16000,
  MAX_LLM_CONTEXT_LENGTH: 100000,

  // Translation
  MAX_TRANSLATE_TEXT_LENGTH: 1000000,

  // Numbers
  MIN_ORDER: 0,
  MAX_ORDER: 10000,
};
```

---

## 📊 Статистика

- **Всего DTO файлов проверено:** 41
- **Критических проблем:** 6 категорий
- **Средних проблем:** 5 категорий
- **Хороших практик найдено:** 5

---

## ✅ Следующие шаги

1. Создать файл с константами валидации
2. Обновить все DTO согласно рекомендациям
3. Добавить unit-тесты для валидации граничных случаев
4. Обновить документацию API с новыми лимитами
