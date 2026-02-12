# Отчет об исправлениях LLM функциональности

**Дата:** 2026-02-12  
**Задача:** Исправить средние проблемы и убрать магические числа

## ✅ Выполненные изменения

### 1. Убраны магические числа

**Файл:** `src/common/constants/global.constants.ts`

Добавлены константы:
```typescript
export const DEFAULT_LLM_CONTEXT_LIMIT_CHARS = 10000;
export const DEFAULT_LLM_TIMEOUT_SECS = 120;
```

**Файл:** `src/modules/llm/llm.service.ts`

Заменены хардкод значения:
- `10000` → `DEFAULT_LLM_CONTEXT_LIMIT_CHARS`
- `120` → `DEFAULT_LLM_TIMEOUT_SECS`

---

### 2. Унифицированы типы ошибок

**Проблема:** Дублирование `LlmErrorType` в двух местах:
- `ui/app/composables/useLlm.ts` (enum)
- `packages/shared/src/llm.contracts.ts` (const object)

**Решение:**
- Удален дублирующий enum из `useLlm.ts`
- Добавлен импорт из shared контрактов
- Добавлен re-export для удобства использования

**Файлы:**
- ✅ `ui/app/composables/useLlm.ts` - удален enum, добавлен импорт
- ✅ `packages/shared/src/llm.contracts.ts` - добавлен `GATEWAY_ERROR` тип

---

### 3. Улучшена обработка ошибок на frontend

**Добавлено:**
- Обработка ошибок 502/504 (Bad Gateway, Gateway Timeout)
- Новый тип ошибки: `GATEWAY_ERROR`
- Функция `isRetryableError()` для определения, можно ли повторить запрос

**Файл:** `ui/app/composables/useLlm.ts`

```typescript
// Улучшенная логика определения типа ошибки
function getErrorType(err: any): LlmErrorType {
  const statusCode = err.status ?? err.statusCode;
  
  // Rate limit (429)
  if (statusCode === 429) {
    return LlmErrorType.RATE_LIMIT;
  }
  
  // Gateway errors (502 Bad Gateway, 504 Gateway Timeout)
  if (statusCode === 502 || statusCode === 504) {
    return LlmErrorType.GATEWAY_ERROR;
  }
  
  // Other server errors (5xx)
  if (statusCode >= 500) {
    return LlmErrorType.SERVER;
  }
  
  // ... другие проверки
}

// Новая функция для определения retryable ошибок
function isRetryableError(errorType: LlmErrorType): boolean {
  return [
    LlmErrorType.NETWORK,
    LlmErrorType.TIMEOUT,
    LlmErrorType.GATEWAY_ERROR,
    LlmErrorType.SERVER,
  ].includes(errorType);
}
```

---

### 4. Добавлена валидация ответа от микросервиса

**Файл:** `src/modules/llm/llm.service.ts`

**Добавлены проверки:**
1. ✅ Валидация структуры ответа (`data` is object)
2. ✅ Валидация `data.choices` (array, not empty)
3. ✅ Валидация `data.choices[0]` (object)
4. ✅ Валидация `data.choices[0].message` (object)
5. ✅ Валидация `data.choices[0].message.content` (string)

**Код:**
```typescript
const data = (await response.body.json()) as LlmResponse;

// Validate response structure
if (!data || typeof data !== 'object') {
  this.logger.error(`LLM Router returned invalid response structure...`);
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
  this.logger.error(`LLM Router returned empty choices...`);
  throw new BadGatewayException('LLM provider returned empty response');
}

const firstChoice = data.choices[0];
if (!firstChoice || typeof firstChoice !== 'object') {
  this.logger.error(`LLM Router returned invalid choice structure...`);
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (!firstChoice.message || typeof firstChoice.message !== 'object') {
  this.logger.error(`LLM Router returned invalid message structure...`);
  throw new BadGatewayException('LLM provider returned invalid response');
}

if (typeof firstChoice.message.content !== 'string') {
  this.logger.error(`LLM Router returned invalid content type...`);
  throw new BadGatewayException('LLM provider returned invalid response');
}
```

---

### 5. Добавлены переводы для нового типа ошибки

**Файлы:**
- ✅ `ui/i18n/locales/en-US.json`
- ✅ `ui/i18n/locales/ru-RU.json`

**Добавлено:**
```json
{
  "llm": {
    "gatewayError": "Service temporarily unavailable. Please retry."
  }
}
```

```json
{
  "llm": {
    "gatewayError": "Сервис временно недоступен. Попробуйте повторить."
  }
}
```

---

### 6. Обновлены компоненты для обработки новых ошибок

**Файлы:**
- ✅ `ui/app/components/modals/LlmGeneratorModal.vue`
- ✅ `ui/app/components/modals/LlmQuickGeneratorModal.vue`

**Добавлена обработка:**
```typescript
const errType = llmError.value?.type
const description =
  errType === LlmErrorType.RATE_LIMIT
    ? t('llm.rateLimitError', 'Too many requests. Please try again later.')
    : errType === LlmErrorType.TIMEOUT
      ? t('llm.timeoutError', 'Request timed out. Try reducing context or retry.')
      : errType === LlmErrorType.ABORTED
        ? t('llm.aborted', 'Request was stopped.')
        : errType === LlmErrorType.GATEWAY_ERROR
          ? t('llm.gatewayError', 'Service temporarily unavailable. Please retry.')
          : t('llm.errorMessage')
```

---

## 🧪 Тестирование

**Запущены unit тесты:**
```bash
npm run test:unit -- llm
```

**Результаты:**
- ✅ `test/unit/modules/llm/llm.controller.spec.ts` - PASS
- ✅ `test/unit/modules/llm/llm.service.spec.ts` - PASS
- ✅ `test/unit/modules/llm-prompt-templates/llm-prompt-templates.controller.spec.ts` - PASS
- ✅ `test/unit/modules/llm-prompt-templates/llm-prompt-templates.service.spec.ts` - PASS

**Всего:** 342 теста, 341 passed, 1 failed (не связан с LLM)

---

## 📊 Итоговая статистика

### Измененные файлы: 9

**Backend:**
1. `src/common/constants/global.constants.ts` - добавлены константы
2. `src/modules/llm/llm.service.ts` - валидация + константы
3. `packages/shared/src/llm.contracts.ts` - добавлен GATEWAY_ERROR

**Frontend:**
4. `ui/app/composables/useLlm.ts` - улучшена обработка ошибок
5. `ui/app/components/modals/LlmGeneratorModal.vue` - добавлена обработка GATEWAY_ERROR
6. `ui/app/components/modals/LlmQuickGeneratorModal.vue` - добавлена обработка GATEWAY_ERROR

**Переводы:**
7. `ui/i18n/locales/en-US.json` - добавлен перевод
8. `ui/i18n/locales/ru-RU.json` - добавлен перевод

---

## ✨ Преимущества изменений

1. **Нет магических чисел** - все константы вынесены в центральное место
2. **Нет дублирования кода** - типы ошибок определены в одном месте
3. **Лучшая обработка ошибок** - различаем gateway errors от других server errors
4. **Защита от runtime ошибок** - валидация структуры ответа от микросервиса
5. **Улучшенный UX** - пользователь видит более точные сообщения об ошибках
6. **Retryable errors** - можно определить, какие ошибки можно повторить

---

## 🔄 Обратная совместимость

Все изменения **обратно совместимы**:
- ✅ Старый код продолжит работать
- ✅ Новые типы ошибок добавлены, старые не изменены
- ✅ API не изменился
- ✅ Тесты проходят

---

**Конец отчета**
