# План унификации дизайна UI

## Текущее состояние

### Проблемы в формах

1. **Несогласованные отступы и spacing**:
   - `ProjectForm.vue`: использует `space-y-6` для полей
   - `ChannelForm.vue`: использует `space-y-6` для основных полей, `space-y-4` для секций
   - `PublicationForm.vue`: использует `space-y-6` для основных полей

2. **Разные стили для секций**:
   - `ProjectForm.vue`: секции разделены `border-t` с `pt-6`
   - `ChannelForm.vue`: секции разделены `border-t` с `pt-4`
   - `PublicationForm.vue`: использует `border-t` с `pt-6 mt-2` для advanced fields

3. **Несогласованные стили заголовков**:
   - Основной заголовок: `text-xl font-semibold` (ProjectForm, ChannelForm)
   - Заголовок секции: `text-sm font-semibold` (ProjectForm, ChannelForm)
   - PublicationForm не имеет заголовков секций

4. **Разные стили для wrapper контейнеров**:
   - `ProjectForm.vue`: `bg-white dark:bg-gray-800 rounded-lg shadow p-6` (когда не flat)
   - `ChannelForm.vue`: `bg-white dark:bg-gray-800 rounded-lg shadow p-6` (когда не hideHeader)
   - `PublicationForm.vue`: нет wrapper контейнера

5. **Несогласованные размеры полей**:
   - `ProjectForm`: использует `size="lg"` для Input
   - `ChannelForm`: использует `size="lg"` для Input
   - `PublicationForm`: использует `size="lg"` для Input (только для title)

6. **Разные подходы к advanced fields**:
   - `PublicationForm`: использует Transition с кнопкой toggle
   - Другие формы: нет advanced fields

## Дизайн-система

### Текущие токены (из main.css)

```css
--font-sans: "Inter"
--radius-telegram: 12px
--text-xxs: 0.625rem (10px)
```

### Утилиты

```css
.app-card: bg-white dark:bg-gray-800 rounded-lg shadow border
.app-card-hover: hover:shadow-md hover:bg-gray-50 transition
```

## План унификации

### 1. Создать единые константы для spacing

**Файл**: `ui/app/utils/design-tokens.ts`

```typescript
export const FORM_SPACING = {
  // Основные отступы
  container: 'p-6',
  section: 'space-y-6',
  fields: 'space-y-6',
  
  // Разделители секций
  sectionDivider: 'border-t border-gray-200 dark:border-gray-700 pt-6',
  
  // Отступы для вложенных элементов
  nested: 'space-y-4',
  
  // Отступы для footer/actions
  footer: 'pt-6',
} as const

export const FORM_STYLES = {
  // Wrapper контейнера
  wrapper: 'bg-white dark:bg-gray-800 rounded-lg shadow p-6',
  
  // Заголовки
  title: 'text-xl font-semibold text-gray-900 dark:text-white',
  subtitle: 'mt-1 text-sm text-gray-500 dark:text-gray-400',
  sectionTitle: 'text-sm font-semibold text-gray-900 dark:text-white mb-4',
  
  // Поля
  inputSize: 'lg',
} as const
```

### 2. Унифицировать структуру форм

**Общая структура**:

```vue
<template>
  <div :class="[flat ? '' : FORM_STYLES.wrapper]">
    <!-- Header (опционально) -->
    <div v-if="!hideHeader" class="mb-6">
      <h2 :class="FORM_STYLES.title">{{ title }}</h2>
      <p :class="FORM_STYLES.subtitle">{{ subtitle }}</p>
    </div>

    <UForm :schema="schema" :state="state" :class="FORM_SPACING.section" @submit="handleSubmit">
      <!-- General section -->
      <div v-if="visibleSections.includes('general')" :class="FORM_SPACING.fields">
        <!-- Fields -->
      </div>

      <!-- Other sections with divider -->
      <div v-if="visibleSections.includes('other')" :class="FORM_SPACING.fields">
        <div v-if="!hideHeader && visibleSections.includes('general')" :class="FORM_SPACING.sectionDivider">
          <h3 :class="FORM_STYLES.sectionTitle">{{ sectionTitle }}</h3>
        </div>
        <!-- Fields -->
      </div>

      <!-- Form actions -->
      <UiFormActions ... />
    </UForm>
  </div>
</template>
```

### 3. Унифицировать стили полей

**Все Input поля**:
- Использовать `size="lg"` для основных полей (name, title)
- Использовать стандартный размер для остальных
- Всегда добавлять `class="w-full"`

**Все Textarea поля**:
- Использовать `:rows="3"` по умолчанию
- Добавлять `class="w-full"`

**Все Select поля**:
- Добавлять `class="w-full"`

### 4. Унифицировать advanced fields

Создать общий компонент `FormAdvancedSection.vue`:

```vue
<template>
  <div>
    <!-- Toggle button -->
    <div class="flex justify-center">
      <UButton
        variant="outline"
        color="neutral"
        size="sm"
        :icon="modelValue ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        class="rounded-full"
        @click="$emit('update:modelValue', !modelValue)"
      >
        {{ modelValue ? hideLabel : showLabel }}
      </UButton>
    </div>
    
    <!-- Content with transition -->
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="modelValue"
        :class="[FORM_SPACING.sectionDivider, FORM_SPACING.fields, 'mt-2']"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>
```

### 5. Унифицировать grid layouts

**Для двухколоночных полей**:
```vue
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
  <!-- Fields -->
</div>
```

**Для метрик**:
```vue
<div class="grid grid-cols-2 gap-3">
  <CommonMetricBox ... />
</div>
```

### 6. Унифицировать стили для read-only полей

Уже используется `CommonFormReadOnlyField` - отлично!

### 7. Унифицировать стили для channel selection

В `PublicationForm.vue` используется кастомный grid для выбора каналов.
Стиль хороший, но можно вынести в отдельный компонент `FormChannelSelector.vue`.

## Приоритеты реализации

1. ✅ **Высокий**: Создать файл с константами дизайн-токенов
2. ✅ **Высокий**: Унифицировать spacing во всех формах
3. ✅ **Высокий**: Унифицировать стили заголовков
4. ✅ **Средний**: Создать компонент FormAdvancedSection
5. ✅ **Средний**: Унифицировать размеры полей
6. ✅ **Низкий**: Создать компонент FormChannelSelector

## Чеклист изменений

### ProjectForm.vue
- [x] Применить константы spacing
- [x] Применить константы стилей
- [x] Проверить размеры полей

### ChannelForm.vue
- [x] Применить константы spacing
- [x] Применить константы стилей
- [x] Проверить размеры полей
- [x] Унифицировать стили секций

### PublicationForm.vue
- [x] Применить константы spacing
- [x] Применить константы стилей
- [x] Использовать FormAdvancedSection
- [x] Проверить размеры полей
- [x] Рассмотреть создание FormChannelSelector
