# Аудит LLM функциональности

**Дата:** 2026-02-12  
**Версия:** 1.0

## Оглавление
1. [Обзор архитектуры](#обзор-архитектуры)
2. [Выявленные проблемы](#выявленные-проблемы)
3. [Анализ retry логики](#анализ-retry-логики)
4. [Недоделки и нелогичности](#недоделки-и-нелогичности)
5. [Рекомендации](#рекомендации)

---

## Обзор архитектуры

### Уровни LLM функциональности

#### 1. Backend (NestJS)
- **Модуль:** `src/modules/llm/`
- **Сервис:** `LlmService` - основной сервис для взаимодействия с Free LLM Router микросервисом
- **Контроллер:** `LlmController` - два эндпоинта:
  - `POST /api/v1/llm/generate` - генерация контента
  - `POST /api/v1/llm/generate-publication-fields` - генерация полей публикации
- **Конфигурация:** `src/config/llm.config.ts` - 15+ параметров конфигурации

#### 2. Frontend (Nuxt/Vue)
- **Composable:** `ui/app/composables/useLlm.ts` - клиентская логика
- **Модальные окна:**
  - `LlmGeneratorModal.vue` - полноценный генератор с чатом (1357 строк)
  - `LlmQuickGeneratorModal.vue` - быстрый генератор (351 строка)
  - `LlmPromptTemplatePickerModal.vue` - выбор шаблонов промптов
- **Настройки:** `SettingsLlmPromptTemplates.vue` - управление шаблонами

#### 3. Shared контракты
- **Файл:** `packages/shared/src/llm.contracts.ts`
- **Интерфейсы:** типизация запросов/ответов между frontend и backend

---

## Выявленные проблемы

### 🔴 Критические проблемы

#### 1. Отсутствие retry логики на уровне приложения
**Местоположение:** `src/modules/llm/llm.service.ts`

**Проблема:**
```typescript
// В методе callLlmRouter (строки 73-157)
private async callLlmRouter(
  requestBody: Record<string, any>,
  logContext: Record<string, any>,
  options: { signal?: AbortSignal } = {},
) {
  // ... код отправки запроса
  const response = await request(url, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify(requestBody),
    signal: options.signal,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });
  
  // НЕТ RETRY ЛОГИКИ!
  // При ошибке сразу бросается исключение
}
```

**Комментарий в коде (строка 281):**
```typescript
/**
 * Generate content using LLM Router.
 * Relies on the external microservice for retries and limit management.
 */
```

**Вывод:** Приложение **полностью полагается** на retry логику микросервиса Free LLM Router. Это создает проблемы:
- Если микросервис недоступен, нет локальных retry
- Нет контроля над retry стратегией на уровне приложения
- Невозможно настроить retry для специфичных ошибок приложения

#### 2. Несогласованность конфигурации retry параметров
**Местоположение:** `src/config/llm.config.ts`

**Проблема:**
```typescript
export class LlmConfig {
  // Параметры retry определены в конфигурации
  @IsOptional()
  @IsInt()
  @Min(1)
  public maxModelSwitches?: number;  // Строка 48

  @IsOptional()
  @IsInt()
  @Min(0)
  public maxSameModelRetries?: number;  // Строка 57

  @IsOptional()
  @IsInt()
  @Min(0)
  public retryDelay?: number;  // Строка 66
}
```

**НО:** Эти параметры передаются в микросервис, а не используются локально:
```typescript
// В generateContent (строки 310-319)
const requestBody = {
  messages,
  temperature: dto.temperature ?? this.config.temperature,
  max_tokens: dto.max_tokens ?? this.config.maxTokens,
  model: dto.model,
  tags: dto.tags || this.config.defaultTags,
  type: this.config.defaultType,
  // Передаются в микросервис, но НЕ используются локально
  ...filterUndefined({
    max_model_switches: this.config.maxModelSwitches,
    max_same_model_retries: this.config.maxSameModelRetries,
    retry_delay: this.config.retryDelay,
    // ...
  }),
};
```

**Вывод:** Параметры retry настраиваются, но работают только на стороне микросервиса. Это создает путаницу:
- Пользователь настраивает retry в `.env`, но не понимает, что это для микросервиса
- Нет документации, объясняющей это разделение ответственности
- В `CONFIGURATION.md` вообще нет упоминания LLM retry параметров

#### 3. Отсутствие fallback на уровне приложения
**Местоположение:** `src/config/llm.config.ts`, `src/modules/llm/llm.service.ts`

**Проблема:**
```typescript
// В конфигурации есть fallback параметры
public fallbackProvider?: string;  // Строка 83
public fallbackModel?: string;     // Строка 91

// Но они также передаются в микросервис
...filterUndefined({
  fallback_provider: this.config.fallbackProvider,
  fallback_model: this.config.fallbackModel,
  // ...
}),
```

**Вывод:** Нет локального fallback механизма, если микросервис полностью недоступен.

### 🟡 Средние проблемы

#### 4. Неполная обработка ошибок на frontend
**Местоположение:** `ui/app/composables/useLlm.ts`

**Проблема:**
```typescript
// Строки 91-123
function getErrorType(err: any): LlmErrorType {
  if (!err) return LlmErrorType.UNKNOWN;

  // Проверка на abort
  if (String(err.message || '').toLowerCase().includes('aborted')) {
    return LlmErrorType.ABORTED;
  }

  // Network errors
  if (err.name === 'NetworkError' || err.message?.includes('network')) {
    return LlmErrorType.NETWORK;
  }

  // Timeout errors
  if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
    return LlmErrorType.TIMEOUT;
  }

  // Rate limit (429)
  if (err.status === 429 || err.statusCode === 429) {
    return LlmErrorType.RATE_LIMIT;
  }

  // Server errors (5xx)
  if (err.status >= 500 || err.statusCode >= 500) {
    return LlmErrorType.SERVER;
  }

  return LlmErrorType.UNKNOWN;
}
```

**Недостатки:**
- Нет обработки 502 Bad Gateway (когда микросервис недоступен)
- Нет обработки 504 Gateway Timeout
- Нет различия между временными и постоянными ошибками
- Нет рекомендаций пользователю (retry / не retry)

#### 5. Дублирование кода определения типов ошибок
**Местоположение:** 
- `ui/app/composables/useLlm.ts` (строки 64-71)
- `packages/shared/src/llm.contracts.ts` (строки 69-78)

**Проблема:**
```typescript
// В useLlm.ts
export enum LlmErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  ABORTED = 'aborted',
  SERVER = 'server',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

// В llm.contracts.ts
export const LlmErrorType = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  ABORTED: 'aborted',
  SERVER: 'server',
  RATE_LIMIT: 'rate_limit',
  UNKNOWN: 'unknown',
} as const;
```

**Вывод:** Дублирование типов, разные подходы (enum vs const object).

#### 6. Отсутствие валидации ответа от микросервиса
**Местоположение:** `src/modules/llm/llm.service.ts`

**Проблема:**
```typescript
// Строки 114-124
const data = (await response.body.json()) as LlmResponse;
if (!data.choices || data.choices.length === 0) {
  this.logger.error(
    `LLM Router returned empty choices. Context=${JSON.stringify({
      ...logContext,
      model: data.model,
      router: data._router,
    })}`,
  );
  throw new BadGatewayException('LLM provider returned empty response');
}
```

**Недостатки:**
- Нет проверки структуры `data.choices[0].message`
- Нет проверки `data.choices[0].message.content`
- Может упасть с `Cannot read property 'content' of undefined`

#### 7. Неоптимальная обработка контекста в LlmGeneratorModal
**Местоположение:** `ui/app/components/modals/LlmGeneratorModal.vue`

**Проблема:**
```typescript
// Строки 344-371
function makeContextPromptBlock(tags: LlmContextTag[]): string {
  const rawParts = tags
    .filter(t => t.enabled)
    .map((t) => t.promptText?.trim())
    .filter((x): x is string => Boolean(x))

  if (rawParts.length === 0) return ''

  const limit = contextLimit.value
  let remaining = limit

  const parts: string[] = []
  for (const part of rawParts) {
    if (remaining <= 0) break

    const trimmed = part.trim()
    if (!trimmed) continue

    const next = truncateText(trimmed, remaining)
    if (!next.trim()) continue

    parts.push(next)
    remaining -= next.length
  }

  if (parts.length === 0) return ''
  return `\n\n${parts.join('\n')}`
}
```

**Проблемы:**
- Обрезка по символам, а не по токенам (может обрезать посередине слова)
- Нет приоритизации контекста (все теги равноправны)
- Нет умной обрезки (например, сохранение целых предложений)

### 🟢 Незначительные проблемы

#### 8. Отсутствие метрик и мониторинга
**Проблема:** Нет сбора метрик:
- Количество запросов к LLM
- Время ответа
- Количество ошибок по типам
- Использование токенов
- Стоимость запросов (если применимо)

#### 9. Неполная документация
**Местоположение:** `docs/CONFIGURATION.md`

**Проблема:**
```markdown
## UI / LLM

- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_DEFAULT` (optional, default: `10000`)
- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_ARTICLE` (optional, default: `100000`)
```

**Отсутствует:**
- Описание всех `FREE_LLM_ROUTER_*` параметров
- Объяснение, что retry работает на стороне микросервиса
- Примеры настройки для разных сценариев
- Troubleshooting guide

#### 10. Хардкод значений в коде
**Местоположение:** `src/modules/llm/llm.service.ts`

**Проблема:**
```typescript
// Строка 63
private readonly defaultContextLimitChars = 10000;

// Строка 70
return (this.config.timeoutSecs ?? this.defaultRequestTimeoutSecs ?? 120) * 1000;
```

**Вывод:** Магические числа вместо констант.

---

## Анализ retry логики

### Текущая реализация

#### На уровне приложения (Backend)
**Вывод:** ❌ **Retry логики НЕТ**

Код в `LlmService.callLlmRouter`:
```typescript
try {
  const response = await request(url, {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify(requestBody),
    signal: options.signal,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });
  
  // Проверка статуса
  if (response.statusCode >= 400) {
    // ... логирование
    if (response.statusCode === 429) {
      throw new HttpException('LLM rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new BadGatewayException('LLM provider request failed');
  }
  
  return data;
} catch (error: any) {
  // Обработка ошибок БЕЗ retry
  if (error?.name === 'AbortError' || options.signal?.aborted) {
    throw new HttpException('Request aborted', 499);
  }
  
  if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS)
    throw error;
  if (error instanceof BadGatewayException) throw error;
  
  const message = String(error?.message || 'Unknown error');
  const isTimeout = message.toLowerCase().includes('timeout');
  
  if (isTimeout) {
    throw new RequestTimeoutException('LLM provider request timed out');
  }
  
  throw new BadGatewayException('LLM provider request failed');
}
```

**Анализ:**
- ✅ Есть обработка timeout
- ✅ Есть обработка rate limit (429)
- ✅ Есть обработка abort
- ❌ НЕТ retry при временных ошибках
- ❌ НЕТ exponential backoff
- ❌ НЕТ jitter

#### На уровне микросервиса (Free LLM Router)
**Вывод:** ✅ **Retry логика ЕСТЬ** (предполагается)

Параметры, передаваемые в микросервис:
```typescript
const requestBody = {
  messages,
  temperature,
  max_tokens,
  model,
  tags,
  type,
  // Retry параметры
  max_model_switches: this.config.maxModelSwitches,      // Макс. переключений моделей
  max_same_model_retries: this.config.maxSameModelRetries, // Макс. retry на одной модели
  retry_delay: this.config.retryDelay,                   // Задержка между retry (мс)
  timeout_secs: this.config.timeoutSecs,                 // Таймаут запроса
  fallback_provider: this.config.fallbackProvider,       // Fallback провайдер
  fallback_model: this.config.fallbackModel,             // Fallback модель
  // ...
};
```

**Как настраиваются:**
```bash
# .env файл
FREE_LLM_ROUTER_MAX_MODEL_SWITCHES=3      # По умолчанию: не задано
FREE_LLM_ROUTER_MAX_SAME_MODEL_RETRIES=2  # По умолчанию: не задано
FREE_LLM_ROUTER_RETRY_DELAY=3000          # По умолчанию: не задано (мс)
FREE_LLM_ROUTER_TIMEOUT_SECS=120          # По умолчанию: 120
FREE_LLM_ROUTER_FALLBACK_PROVIDER=""      # По умолчанию: не задано
FREE_LLM_ROUTER_FALLBACK_MODEL=""         # По умолчанию: не задано
```

#### На уровне Frontend
**Вывод:** ❌ **Retry логики НЕТ**

Код в `useLlm.ts`:
```typescript
async function generateContent(
  prompt: string,
  options?: GenerateLlmOptions,
): Promise<LlmResponse | null> {
  isGenerating.value = true;
  error.value = null;
  isAborted.value = false;
  activeController.value?.abort();
  activeController.value = api.createAbortController();

  try {
    const response = await post<LlmResponse>(
      '/llm/generate',
      { prompt, ...options },
      { signal: activeController.value.signal },
    );
    return response;
  } catch (err: any) {
    // Обработка ошибок БЕЗ retry
    const errorType = getErrorType(err);
    const msg = err.data?.message || err.message || 'Failed to generate content';
    
    if (errorType === LlmErrorType.ABORTED) {
      isAborted.value = true;
    }
    
    error.value = { type: errorType, message: msg, originalError: err };
    console.error('LLM: Generation error:', err);
    return null;
  } finally {
    isGenerating.value = false;
    activeController.value = null;
  }
}
```

**Анализ:**
- ✅ Есть обработка ошибок
- ✅ Есть типизация ошибок
- ✅ Есть поддержка отмены (AbortController)
- ❌ НЕТ retry при временных ошибках
- ❌ НЕТ автоматического повтора при сетевых ошибках

### Проблемы текущей архитектуры retry

#### 1. Единая точка отказа
Если микросервис Free LLM Router недоступен:
- Приложение не может сделать retry
- Нет fallback на другой сервис
- Пользователь получает ошибку сразу

#### 2. Отсутствие контроля
Приложение не контролирует:
- Стратегию retry (exponential backoff, jitter)
- Условия retry (какие ошибки retry, какие нет)
- Логирование retry попыток
- Метрики retry

#### 3. Путаница в конфигурации
Параметры retry в `.env` файле:
- Не очевидно, что они для микросервиса
- Не понятно, как они влияют на поведение
- Нет документации

#### 4. Невозможность отладки
При проблемах с retry:
- Нет логов на уровне приложения
- Нет информации о попытках
- Нет метрик

---

## Недоделки и нелогичности

### 1. Несогласованность timeout конфигурации

**Проблема:**
```typescript
// В llm.config.ts
public timeoutSecs?: number;  // Таймаут для микросервиса

// В llm.service.ts
private getRequestTimeoutMs(): number {
  return (this.config.timeoutSecs ?? this.defaultRequestTimeoutSecs ?? 120) * 1000;
}

// НО: этот таймаут используется для HTTP запроса к микросервису
const response = await request(url, {
  headersTimeout: timeout,
  bodyTimeout: timeout,
});

// И ТАКЖЕ передается в микросервис
const requestBody = {
  timeout_secs: this.config.timeoutSecs,
};
```

**Вывод:** Один параметр `timeoutSecs` используется дважды:
1. Как таймаут HTTP запроса к микросервису
2. Как параметр для микросервиса (таймаут запроса к LLM провайдеру)

**Нелогичность:** Если установить `FREE_LLM_ROUTER_TIMEOUT_SECS=120`, то:
- HTTP запрос к микросервису будет иметь таймаут 120 сек
- Микросервис будет ждать ответ от LLM провайдера 120 сек
- **Итого:** общий таймаут может быть 240 сек!

### 2. Дублирование логики парсинга JSON

**Проблема:**
```typescript
// В llm.service.ts есть три метода для парсинга JSON:

// 1. stripCodeFences (строки 169-173)
private stripCodeFences(text: string): string {
  return String(text || '')
    .replace(/```(?:json)?\n?|\n?```/g, '')
    .trim();
}

// 2. tryExtractFirstJsonObject (строки 175-207)
private tryExtractFirstJsonObject(text: string): string | null {
  // Сложная логика извлечения JSON из текста
}

// 3. parseJsonFromLlmContent (строки 209-224)
private parseJsonFromLlmContent(content: string): any {
  const clean = this.stripCodeFences(content);
  try {
    return JSON.parse(clean);
  } catch {
    const extracted = this.tryExtractFirstJsonObject(clean);
    if (!extracted) {
      throw new BadGatewayException('LLM returned invalid JSON');
    }
    try {
      return JSON.parse(extracted);
    } catch {
      throw new BadGatewayException('LLM returned invalid JSON');
    }
  }
}
```

**Вывод:** Сложная логика парсинга, но:
- Используется только для `parsePublicationFieldsResponse`
- Для `generateContent` используется `extractContent` (простой текст)
- Нет единого подхода

### 3. Неиспользуемый метод `generateChat`

**Проблема:**
```typescript
// В llm.service.ts (строки 226-267)
public async generateChat(
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
    tags?: string[];
    type?: string;
    signal?: AbortSignal;
  } = {},
): Promise<LlmResponse> {
  // ... реализация
}
```

**Вывод:** Метод `generateChat` объявлен как `public`, но:
- ❌ Не используется в контроллере
- ❌ Не используется в других сервисах
- ❌ Не документирован
- ❓ Зачем он нужен?

**Возможные причины:**
1. Планировалось использовать, но забыли
2. Используется для внутренних целей (но тогда должен быть `private`)
3. Legacy код

### 4. Несогласованность обработки `response_format`

**Проблема:**
```typescript
// В generatePublicationFields (строка 369)
const requestBody = {
  messages: [...],
  temperature: ...,
  max_tokens: ...,
  response_format: { type: 'json_object' },  // ← Только здесь!
  // ...
};

// В generateContent (строки 302-320)
const requestBody = {
  messages: [...],
  temperature: ...,
  max_tokens: ...,
  // НЕТ response_format!
};
```

**Вывод:** 
- `generatePublicationFields` использует `response_format: { type: 'json_object' }`
- `generateContent` НЕ использует
- Не понятно, почему разный подход

### 5. Странная логика `buildFullPrompt`

**Проблема:**
```typescript
// В llm.service.ts (строки 398-426)
private buildFullPrompt(dto: GenerateContentDto): string {
  const contextLimit = dto.contextLimitChars ?? this.defaultContextLimitChars;
  const parts: string[] = [];

  // Если есть selectionText, добавляем его
  if (dto.selectionText?.trim()) {
    parts.push(`<selection>\n${dto.selectionText.trim()}\n</selection>`);
  }

  // Если НЕТ selectionText, добавляем content
  if (!dto.selectionText?.trim()) {
    const content = dto.useContent ? dto.content : undefined;
    if (content?.trim()) {
      parts.push(`<source_content>\n${content.trim()}\n</source_content>`);
    }
  }

  // Добавляем mediaDescriptions
  if (Array.isArray(dto.mediaDescriptions)) {
    for (const raw of dto.mediaDescriptions) {
      const text = String(raw ?? '').trim();
      if (!text) continue;
      parts.push(`<image_description>${text}</image_description>`);
    }
  }

  const contextBlockRaw = parts.join('\n');
  const contextBlock = contextBlockRaw.slice(0, Math.max(0, contextLimit));

  return contextBlock ? `${dto.prompt.trim()}\n\n${contextBlock}` : dto.prompt;
}
```

**Нелогичности:**
1. Если есть `selectionText`, `content` игнорируется (даже если `useContent=true`)
2. `mediaDescriptions` добавляются всегда, независимо от `selectionText`
3. Обрезка по символам (`slice`), а не по токенам
4. Обрезка может разрезать XML теги (`<selection>`, `<image_description>`)

### 6. Отсутствие валидации `publicationLanguage`

**Проблема:**
```typescript
// В generate-publication-fields.dto.ts (строки 64-67)
@IsString()
@IsNotEmpty()
@MaxLength(20)
publicationLanguage!: string;
```

**Вывод:**
- Нет проверки формата (должно быть `en-US`, `ru-RU`, etc.)
- Можно передать любую строку до 20 символов
- Может привести к неожиданному поведению LLM

### 7. Неоптимальная структура `LlmGeneratorModal`

**Проблема:**
- **1357 строк** в одном файле
- Смешаны:
  - Логика чата
  - Логика генерации полей
  - Логика управления контекстом
  - Логика STT
  - UI компоненты
- Сложно поддерживать и тестировать

**Рекомендация:** Разбить на несколько компонентов:
- `LlmChatStep.vue` - шаг с чатом
- `LlmFieldsStep.vue` - шаг с полями
- `LlmContextManager.vue` - управление контекстом
- `useLlmChat.ts` - composable для чата
- `useLlmFields.ts` - composable для полей

### 8. Отсутствие rate limiting на уровне приложения

**Проблема:**
- Нет защиты от слишком частых запросов к LLM
- Пользователь может спамить запросами
- Может привести к:
  - Превышению квот микросервиса
  - Высоким затратам (если LLM платный)
  - DDoS микросервиса

**Рекомендация:** Добавить rate limiting:
- На уровне пользователя (например, 10 запросов в минуту)
- На уровне проекта
- С информативными сообщениями об ошибках

### 9. Отсутствие кеширования ответов

**Проблема:**
- Одинаковые запросы к LLM выполняются каждый раз
- Нет кеширования результатов
- Неэффективное использование ресурсов

**Пример:**
Пользователь генерирует поля публикации с одним и тем же текстом несколько раз → каждый раз новый запрос к LLM.

**Рекомендация:** Добавить кеширование:
- По хешу запроса (prompt + параметры)
- С TTL (например, 1 час)
- С возможностью принудительного обновления

### 10. Отсутствие версионирования промптов

**Проблема:**
```typescript
// В llm.constants.ts
export const PUBLICATION_FIELDS_SYSTEM_PROMPT = `...`;
export const RAW_RESULT_SYSTEM_PROMPT = `...`;
```

**Вывод:**
- Промпты хардкодятся в коде
- При изменении промпта нет истории
- Невозможно A/B тестирование
- Невозможно откатить изменения

**Рекомендация:** Добавить версионирование:
- Хранить промпты в БД
- Версионировать изменения
- Возможность A/B тестирования

---

## Рекомендации

### Приоритет 1: Критические (внедрить в первую очередь)

#### 1.1. Добавить retry логику на уровне приложения

**Цель:** Повысить надежность при временных сбоях микросервиса.

**Реализация:**
```typescript
// Создать новый файл: src/common/utils/retry.utils.ts
import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    retryableErrors = () => true,
    onRetry,
  } = options;

  let lastError: any;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      if (attempt === maxAttempts || !retryableErrors(error)) {
        throw error;
      }

      if (onRetry) {
        onRetry(attempt, error);
      }

      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 * delay; // ±30% jitter
      const actualDelay = Math.min(delay + jitter, maxDelayMs);
      
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

// Использование в LlmService
private async callLlmRouter(
  requestBody: Record<string, any>,
  logContext: Record<string, any>,
  options: { signal?: AbortSignal } = {},
) {
  return retryWithBackoff(
    async () => {
      const url = this.getChatCompletionsUrl();
      const timeout = this.getRequestTimeoutMs();

      const response = await request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiToken ? { Authorization: `Bearer ${this.config.apiToken}` } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
        headersTimeout: timeout,
        bodyTimeout: timeout,
      });

      // ... обработка ответа
      return data;
    },
    {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
      retryableErrors: (error) => {
        // Retry только для временных ошибок
        if (error?.name === 'AbortError') return false;
        if (error instanceof HttpException && error.getStatus() === 429) return false;
        
        const statusCode = error?.statusCode || error?.status;
        if (statusCode === 400 || statusCode === 401 || statusCode === 403) return false;
        
        return true; // Retry для 5xx, network errors, timeouts
      },
      onRetry: (attempt, error) => {
        this.logger.warn(
          `LLM Router retry attempt ${attempt}. Error: ${error?.message}. Context=${JSON.stringify(logContext)}`,
        );
      },
    },
  );
}
```

#### 1.2. Улучшить документацию retry параметров

**Цель:** Объяснить пользователям, как работает retry.

**Файл:** `docs/CONFIGURATION.md`

**Добавить секцию:**
```markdown
## LLM Configuration

### Free LLM Router Service

- `FREE_LLM_ROUTER_URL` (required) - URL микросервиса Free LLM Router
- `FREE_LLM_ROUTER_API_TOKEN` (optional) - API токен для авторизации

### Retry Configuration (Microservice Level)

Следующие параметры передаются в микросервис Free LLM Router и управляют его retry логикой:

- `FREE_LLM_ROUTER_MAX_MODEL_SWITCHES` (optional, default: 3) - максимальное количество переключений между моделями при ошибках
- `FREE_LLM_ROUTER_MAX_SAME_MODEL_RETRIES` (optional, default: 2) - максимальное количество повторных попыток на одной модели
- `FREE_LLM_ROUTER_RETRY_DELAY` (optional, default: 3000) - задержка между повторными попытками в миллисекундах

**Важно:** Эти параметры управляют retry логикой **внутри микросервиса** Free LLM Router. 
Приложение также имеет собственную retry логику для обработки временных сбоев связи с микросервисом.

### Timeout Configuration

- `FREE_LLM_ROUTER_TIMEOUT_SECS` (optional, default: 120) - таймаут запроса к LLM провайдеру в секундах

**Важно:** Это таймаут для запроса от микросервиса к LLM провайдеру. 
HTTP запрос от приложения к микросервису имеет дополнительный таймаут (по умолчанию: 30 сек).

### Fallback Configuration

- `FREE_LLM_ROUTER_FALLBACK_PROVIDER` (optional) - fallback провайдер (например, "deepseek")
- `FREE_LLM_ROUTER_FALLBACK_MODEL` (optional) - fallback модель (например, "deepseek-chat")

### Model Selection

- `FREE_LLM_ROUTER_TAGS` (optional, default: "fast") - теги для выбора модели (comma-separated)
- `FREE_LLM_ROUTER_TYPE` (optional, default: "fast") - тип модели: "fast" или "reasoning"
- `FREE_LLM_ROUTER_MIN_CONTEXT_SIZE` (optional) - минимальный размер контекста
- `FREE_LLM_ROUTER_MIN_MAX_OUTPUT_TOKENS` (optional) - минимальное количество выходных токенов

### Generation Defaults

- `FREE_LLM_ROUTER_TEMPERATURE` (optional, default: 0.7) - температура генерации (0-2)
- `FREE_LLM_ROUTER_MAX_TOKENS` (optional, default: 4000) - максимальное количество токенов в ответе

### UI Configuration

- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_DEFAULT` (optional, default: 10000) - максимальный размер контекста в символах для обычных публикаций
- `NUXT_PUBLIC_LLM_CONTEXT_LIMIT_ARTICLE` (optional, default: 100000) - максимальный размер контекста в символах для статей

### Troubleshooting

#### Проблема: "LLM provider request timed out"

**Причина:** Запрос к LLM провайдеру превысил таймаут.

**Решение:**
1. Увеличить `FREE_LLM_ROUTER_TIMEOUT_SECS` (например, до 180)
2. Уменьшить размер контекста
3. Уменьшить `max_tokens`

#### Проблема: "LLM rate limit exceeded"

**Причина:** Превышен лимит запросов к LLM провайдеру.

**Решение:**
1. Подождать несколько минут
2. Настроить fallback провайдер
3. Увеличить `FREE_LLM_ROUTER_RETRY_DELAY`

#### Проблема: "LLM provider request failed"

**Причина:** Ошибка связи с микросервисом или LLM провайдером.

**Решение:**
1. Проверить доступность микросервиса (`FREE_LLM_ROUTER_URL`)
2. Проверить API токен (`FREE_LLM_ROUTER_API_TOKEN`)
3. Проверить логи микросервиса
4. Настроить fallback провайдер
```

#### 1.3. Добавить валидацию ответа от микросервиса

**Цель:** Предотвратить ошибки при некорректном ответе.

**Реализация:**
```typescript
// В llm.service.ts, метод callLlmRouter
const data = (await response.body.json()) as LlmResponse;

// Валидация структуры ответа
if (!data || typeof data !== 'object') {
  this.logger.error(
    `LLM Router returned invalid response. Context=${JSON.stringify(logContext)}`,
  );
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
  this.logger.error(
    `LLM Router returned empty choices. Context=${JSON.stringify({
      ...logContext,
      model: data.model,
      router: data._router,
    })}`,
  );
  throw new BadGatewayException('LLM provider returned empty response');
}

const firstChoice = data.choices[0];
if (!firstChoice || typeof firstChoice !== 'object') {
  this.logger.error(
    `LLM Router returned invalid choice. Context=${JSON.stringify(logContext)}`,
  );
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (!firstChoice.message || typeof firstChoice.message !== 'object') {
  this.logger.error(
    `LLM Router returned invalid message. Context=${JSON.stringify(logContext)}`,
  );
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (typeof firstChoice.message.content !== 'string') {
  this.logger.error(
    `LLM Router returned invalid content. Context=${JSON.stringify(logContext)}`,
  );
  throw new BadGatewayException('LLM provider returned invalid response');
}
```

### Приоритет 2: Важные (внедрить в ближайшее время)

#### 2.1. Унифицировать типы ошибок

**Цель:** Избежать дублирования кода.

**Реализация:**
```typescript
// В packages/shared/src/llm.contracts.ts - оставить только const object
export const LlmErrorType = {
  NETWORK: 'network',
  TIMEOUT: 'timeout',
  ABORTED: 'aborted',
  SERVER: 'server',
  RATE_LIMIT: 'rate_limit',
  GATEWAY_ERROR: 'gateway_error',  // Новый тип для 502/504
  UNKNOWN: 'unknown',
} as const;

export type LlmErrorType = (typeof LlmErrorType)[keyof typeof LlmErrorType];

// В ui/app/composables/useLlm.ts - импортировать из shared
import { LlmErrorType } from '@gran/shared/llm.contracts';

// Удалить дублирующий enum
```

#### 2.2. Улучшить обработку ошибок на frontend

**Цель:** Более точная классификация ошибок.

**Реализация:**
```typescript
// В useLlm.ts
function getErrorType(err: any): LlmErrorType {
  if (!err) return LlmErrorType.UNKNOWN;

  // Abort
  if (String(err.message || '').toLowerCase().includes('aborted')) {
    return LlmErrorType.ABORTED;
  }

  // Network errors
  if (err.name === 'NetworkError' || err.message?.includes('network')) {
    return LlmErrorType.NETWORK;
  }

  // Timeout errors
  if (err.name === 'TimeoutError' || err.message?.includes('timeout')) {
    return LlmErrorType.TIMEOUT;
  }

  // Rate limit (429)
  if (err.status === 429 || err.statusCode === 429) {
    return LlmErrorType.RATE_LIMIT;
  }

  // Gateway errors (502, 504)
  if (err.status === 502 || err.statusCode === 502 ||
      err.status === 504 || err.statusCode === 504) {
    return LlmErrorType.GATEWAY_ERROR;
  }

  // Server errors (5xx)
  if (err.status >= 500 || err.statusCode >= 500) {
    return LlmErrorType.SERVER;
  }

  return LlmErrorType.UNKNOWN;
}

// Добавить helper для определения, можно ли retry
export function isRetryableError(errorType: LlmErrorType): boolean {
  return [
    LlmErrorType.NETWORK,
    LlmErrorType.TIMEOUT,
    LlmErrorType.GATEWAY_ERROR,
    LlmErrorType.SERVER,
  ].includes(errorType);
}

// Добавить helper для получения сообщения пользователю
export function getErrorMessage(errorType: LlmErrorType, t: any): string {
  switch (errorType) {
    case LlmErrorType.NETWORK:
      return t('llm.errors.network', 'Network error. Please check your connection.');
    case LlmErrorType.TIMEOUT:
      return t('llm.errors.timeout', 'Request timed out. Try reducing context or retry.');
    case LlmErrorType.ABORTED:
      return t('llm.errors.aborted', 'Request was stopped.');
    case LlmErrorType.RATE_LIMIT:
      return t('llm.errors.rateLimit', 'Too many requests. Please try again later.');
    case LlmErrorType.GATEWAY_ERROR:
      return t('llm.errors.gateway', 'Service temporarily unavailable. Please retry.');
    case LlmErrorType.SERVER:
      return t('llm.errors.server', 'Server error. Please try again.');
    default:
      return t('llm.errors.unknown', 'An error occurred. Please try again.');
  }
}
```

#### 2.3. Разделить timeout конфигурацию

**Цель:** Избежать путаницы с двойным использованием `timeoutSecs`.

**Реализация:**
```typescript
// В llm.config.ts
export class LlmConfig {
  // ... существующие поля

  /**
   * Request timeout in seconds for HTTP requests to the microservice.
   * Defined by FREE_LLM_ROUTER_HTTP_TIMEOUT_SECS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public httpTimeoutSecs?: number;

  /**
   * Request timeout in seconds for LLM provider requests (passed to microservice).
   * Defined by FREE_LLM_ROUTER_TIMEOUT_SECS environment variable.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  public timeoutSecs?: number;
}

// В registerAs
export default registerAs('llm', (): LlmConfig => {
  const rawConfig: any = {
    // ...
    httpTimeoutSecs: process.env.FREE_LLM_ROUTER_HTTP_TIMEOUT_SECS
      ? parseInt(process.env.FREE_LLM_ROUTER_HTTP_TIMEOUT_SECS, 10)
      : undefined,
    timeoutSecs: process.env.FREE_LLM_ROUTER_TIMEOUT_SECS
      ? parseInt(process.env.FREE_LLM_ROUTER_TIMEOUT_SECS, 10)
      : undefined,
  };
  // ...
});

// В llm.service.ts
private getRequestTimeoutMs(): number {
  return (this.config.httpTimeoutSecs ?? this.defaultRequestTimeoutSecs ?? 30) * 1000;
}
```

#### 2.4. Добавить rate limiting на уровне приложения

**Цель:** Защита от спама запросами.

**Реализация:**
```typescript
// Использовать @nestjs/throttler
// В llm.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // 60 секунд
      limit: 10,    // 10 запросов
    }),
  ],
  controllers: [LlmController],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}

// В llm.controller.ts
import { Throttle } from '@nestjs/throttler';

@Controller('llm')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class LlmController {
  @Post('generate')
  @Throttle(5, 60)  // 5 запросов в минуту для этого эндпоинта
  async generate(@Body() dto: GenerateContentDto) {
    // ...
  }

  @Post('generate-publication-fields')
  @Throttle(3, 60)  // 3 запроса в минуту для этого эндпоинта
  async generatePublicationFields(@Body() dto: GeneratePublicationFieldsDto) {
    // ...
  }
}
```

### Приоритет 3: Желательные (внедрить при возможности)

#### 3.1. Добавить кеширование ответов

**Цель:** Снизить нагрузку на LLM и ускорить ответы.

**Реализация:**
```typescript
// Использовать Redis для кеширования
// В llm.service.ts
import { CACHE_MANAGER, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class LlmService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    // ...
  }

  private getCacheKey(requestBody: Record<string, any>): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify(requestBody));
    return `llm:${hash.digest('hex')}`;
  }

  async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
    const fullPrompt = this.buildFullPrompt(dto);
    const messages: any[] = [
      // ...
    ];

    const requestBody = {
      messages,
      temperature: dto.temperature ?? this.config.temperature,
      max_tokens: dto.max_tokens ?? this.config.maxTokens,
      model: dto.model,
      tags: dto.tags || this.config.defaultTags,
      type: this.config.defaultType,
    };

    // Проверяем кеш
    const cacheKey = this.getCacheKey(requestBody);
    const cached = await this.cacheManager.get<LlmResponse>(cacheKey);
    if (cached) {
      this.logger.debug(`LLM cache hit: ${cacheKey}`);
      return cached;
    }

    // Выполняем запрос
    const response = await this.callLlmRouter(requestBody, {
      method: 'generateContent',
      // ...
    });

    // Сохраняем в кеш (TTL: 1 час)
    await this.cacheManager.set(cacheKey, response, 3600);

    return response;
  }
}
```

#### 3.2. Добавить метрики и мониторинг

**Цель:** Отслеживать производительность и ошибки.

**Реализация:**
```typescript
// Использовать @willsoto/nestjs-prometheus
// В llm.service.ts
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class LlmService {
  constructor(
    private readonly configService: ConfigService,
    @InjectMetric('llm_requests_total') private requestsCounter: Counter,
    @InjectMetric('llm_errors_total') private errorsCounter: Counter,
    @InjectMetric('llm_request_duration_seconds') private durationHistogram: Histogram,
    @InjectMetric('llm_tokens_total') private tokensCounter: Counter,
  ) {
    // ...
  }

  private async callLlmRouter(
    requestBody: Record<string, any>,
    logContext: Record<string, any>,
    options: { signal?: AbortSignal } = {},
  ) {
    const startTime = Date.now();
    const method = logContext.method || 'unknown';

    try {
      this.requestsCounter.inc({ method });

      const response = await request(url, {
        // ...
      });

      const duration = (Date.now() - startTime) / 1000;
      this.durationHistogram.observe({ method, status: 'success' }, duration);

      // Считаем токены
      if (response.usage) {
        this.tokensCounter.inc({ type: 'prompt' }, response.usage.prompt_tokens);
        this.tokensCounter.inc({ type: 'completion' }, response.usage.completion_tokens);
      }

      return response;
    } catch (error: any) {
      const duration = (Date.now() - startTime) / 1000;
      const errorType = this.getErrorType(error);
      
      this.errorsCounter.inc({ method, error_type: errorType });
      this.durationHistogram.observe({ method, status: 'error' }, duration);

      throw error;
    }
  }

  private getErrorType(error: any): string {
    if (error instanceof HttpException) {
      const status = error.getStatus();
      if (status === 429) return 'rate_limit';
      if (status >= 500) return 'server_error';
      if (status >= 400) return 'client_error';
    }
    if (error?.name === 'AbortError') return 'aborted';
    if (error?.message?.toLowerCase().includes('timeout')) return 'timeout';
    return 'unknown';
  }
}
```

#### 3.3. Рефакторинг LlmGeneratorModal

**Цель:** Улучшить поддерживаемость кода.

**Структура:**
```
ui/app/components/modals/llm-generator/
├── LlmGeneratorModal.vue          # Главный компонент (координатор)
├── LlmChatStep.vue                # Шаг 1: Чат
├── LlmFieldsStep.vue              # Шаг 2: Поля
├── LlmContextManager.vue          # Управление контекстом
├── LlmChatMessage.vue             # Сообщение в чате
├── LlmFieldEditor.vue             # Редактор поля
└── composables/
    ├── useLlmChat.ts              # Логика чата
    ├── useLlmFields.ts            # Логика полей
    └── useLlmContext.ts           # Логика контекста
```

#### 3.4. Версионирование промптов

**Цель:** Управление изменениями промптов.

**Реализация:**
```typescript
// Создать новую таблицу в Prisma
model LlmSystemPrompt {
  id        String   @id @default(cuid())
  name      String   @unique
  version   Int      @default(1)
  content   String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([name, isActive])
}

// Создать сервис для управления промптами
@Injectable()
export class LlmPromptsService {
  constructor(private prisma: PrismaService) {}

  async getActivePrompt(name: string): Promise<string> {
    const prompt = await this.prisma.llmSystemPrompt.findFirst({
      where: { name, isActive: true },
      orderBy: { version: 'desc' },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt ${name} not found`);
    }

    return prompt.content;
  }

  async createVersion(name: string, content: string): Promise<LlmSystemPrompt> {
    const latestVersion = await this.prisma.llmSystemPrompt.findFirst({
      where: { name },
      orderBy: { version: 'desc' },
    });

    const newVersion = (latestVersion?.version || 0) + 1;

    return this.prisma.llmSystemPrompt.create({
      data: {
        name,
        version: newVersion,
        content,
        isActive: true,
      },
    });
  }
}

// Использовать в LlmService
async generatePublicationFields(dto: GeneratePublicationFieldsDto): Promise<LlmResponse> {
  const systemPrompt = await this.promptsService.getActivePrompt('PUBLICATION_FIELDS');
  
  const requestBody = {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      // ...
    ],
    // ...
  };

  return this.callLlmRouter(requestBody, {
    method: 'generatePublicationFields',
    // ...
  });
}
```

---

## Заключение

### Общая оценка

**Архитектура:** ⭐⭐⭐⭐☆ (4/5)
- ✅ Хорошее разделение на уровни (backend, frontend, shared)
- ✅ Использование микросервисной архитектуры
- ✅ Типизация с TypeScript
- ❌ Отсутствие retry логики на уровне приложения
- ❌ Единая точка отказа (микросервис)

**Надежность:** ⭐⭐☆☆☆ (2/5)
- ❌ Нет retry на уровне приложения
- ❌ Нет fallback при недоступности микросервиса
- ❌ Неполная валидация ответов
- ✅ Есть обработка ошибок
- ✅ Есть timeout

**Поддерживаемость:** ⭐⭐⭐☆☆ (3/5)
- ✅ Хорошая структура кода
- ✅ Типизация
- ✅ Тесты
- ❌ Слишком большие компоненты (LlmGeneratorModal)
- ❌ Дублирование кода
- ❌ Неполная документация

**Производительность:** ⭐⭐⭐☆☆ (3/5)
- ✅ Асинхронные запросы
- ✅ Поддержка отмены (AbortController)
- ❌ Нет кеширования
- ❌ Нет rate limiting
- ❌ Нет оптимизации контекста

### Итоговая оценка: ⭐⭐⭐☆☆ (3/5)

Функциональность работает, но есть критические проблемы с надежностью и отсутствием retry логики на уровне приложения.

### Приоритетные действия

1. **Немедленно:**
   - Добавить retry логику на уровне приложения
   - Улучшить документацию retry параметров
   - Добавить валидацию ответов от микросервиса

2. **В ближайшее время:**
   - Унифицировать типы ошибок
   - Улучшить обработку ошибок на frontend
   - Разделить timeout конфигурацию
   - Добавить rate limiting

3. **При возможности:**
   - Добавить кеширование
   - Добавить метрики и мониторинг
   - Рефакторинг LlmGeneratorModal
   - Версионирование промптов

---

**Конец отчета**
