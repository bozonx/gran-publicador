# UI Design System - Руководство по использованию

## Обзор

Проект использует единую систему дизайна, основанную на утилитах Tailwind CSS и кастомных дизайн-токенах.

## Дизайн-токены

Все дизайн-токены определены в `app/utils/design-tokens.ts`.

### Карточки (CARD_STYLES)

```typescript
import { CARD_STYLES } from '~/utils/design-tokens'

// Базовые классы карточек
CARD_STYLES.base          // 'app-card' - основной стиль карточки
CARD_STYLES.hover         // 'app-card-hover' - эффект при наведении

// Варианты отступов
CARD_STYLES.paddingCompact   // 'p-3' - компактные отступы
CARD_STYLES.paddingNormal    // 'p-4' - нормальные отступы
CARD_STYLES.paddingSpacious  // 'p-6' - просторные отступы

// Варианты границ
CARD_STYLES.borderPrimary    // Основные границы
CARD_STYLES.borderSubtle     // Тонкие разделители

// Варианты фонов
CARD_STYLES.bgPrimary        // Основной фон
CARD_STYLES.bgSubtle         // Приглушенный фон
```

### Отступы (SPACING)

```typescript
import { SPACING } from '~/utils/design-tokens'

// Вертикальные отступы между элементами
SPACING.sectionGap    // 'space-y-8' - между секциями
SPACING.cardGap       // 'space-y-6' - между карточками
SPACING.fieldGap      // 'space-y-4' - между полями
SPACING.compactGap    // 'space-y-3' - компактные
SPACING.tightGap      // 'space-y-2' - плотные

// Нижние отступы
SPACING.sectionMargin  // 'mb-8'
SPACING.cardMargin     // 'mb-6'
SPACING.fieldMargin    // 'mb-4'
SPACING.compactMargin  // 'mb-3'
SPACING.tightMargin    // 'mb-2'
```

### Сетки (GRID_LAYOUTS)

```typescript
import { GRID_LAYOUTS } from '~/utils/design-tokens'

// Сетки
GRID_LAYOUTS.twoColumn    // 'grid grid-cols-1 md:grid-cols-2 gap-6'
GRID_LAYOUTS.threeColumn  // 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'
GRID_LAYOUTS.metrics      // 'grid grid-cols-2 gap-3'
GRID_LAYOUTS.channelGrid  // 'grid grid-cols-1 sm:grid-cols-2 gap-3'
```

### Формы (FORM_SPACING, FORM_STYLES)

```typescript
import { FORM_SPACING, FORM_STYLES } from '~/utils/design-tokens'

// Отступы форм
FORM_SPACING.container       // 'p-6'
FORM_SPACING.section         // 'space-y-6'
FORM_SPACING.fields          // 'space-y-6'
FORM_SPACING.nested          // 'space-y-4'
FORM_SPACING.sectionDivider  // Разделитель секций
FORM_SPACING.footer          // 'pt-6'

// Стили форм
FORM_STYLES.wrapper          // Обертка формы
FORM_STYLES.title            // Заголовок
FORM_STYLES.subtitle         // Подзаголовок
FORM_STYLES.sectionTitle     // Заголовок секции
```

## Использование

### Основные карточки

```vue
<template>
  <!-- Простая карточка -->
  <div class="app-card p-4">
    Содержимое карточки
  </div>

  <!-- Карточка с hover эффектом -->
  <div class="app-card app-card-hover p-4 cursor-pointer">
    Кликабельная карточка
  </div>

  <!-- Карточка с просторными отступами -->
  <div class="app-card p-6">
    Содержимое с большими отступами
  </div>
</template>
```

### Компонент UiAppCard

Для карточек с заголовком используйте компонент `UiAppCard`:

```vue
<template>
  <UiAppCard
    title="Заголовок"
    description="Описание"
  >
    <template #actions>
      <UButton>Действие</UButton>
    </template>
    
    <template #badges>
      <UBadge>Бейдж</UBadge>
    </template>
    
    <!-- Основное содержимое -->
    <div>Контент</div>
    
    <template #footer>
      <div>Футер</div>
    </template>
  </UiAppCard>
</template>
```

### Списки и сетки

```vue
<template>
  <!-- Список карточек -->
  <div :class="SPACING.cardGap">
    <div class="app-card p-4">Карточка 1</div>
    <div class="app-card p-4">Карточка 2</div>
    <div class="app-card p-4">Карточка 3</div>
  </div>

  <!-- Сетка карточек -->
  <div :class="GRID_LAYOUTS.threeColumn">
    <div class="app-card p-4">Карточка 1</div>
    <div class="app-card p-4">Карточка 2</div>
    <div class="app-card p-4">Карточка 3</div>
  </div>
</template>

<script setup lang="ts">
import { SPACING, GRID_LAYOUTS } from '~/utils/design-tokens'
</script>
```

### Формы

```vue
<template>
  <UForm :schema="schema" :state="state" @submit="handleSubmit">
    <div :class="FORM_SPACING.fields">
      <UFormField name="name" :label="t('common.name')">
        <UInput v-model="state.name" />
      </UFormField>
      
      <UFormField name="description" :label="t('common.description')">
        <UTextarea v-model="state.description" />
      </UFormField>
    </div>

    <UiFormActions
      :loading="isLoading"
      :is-dirty="isDirty"
      :save-label="t('common.save')"
      hide-cancel
      show-border
      class="mt-6"
    />
  </UForm>
</template>

<script setup lang="ts">
import { FORM_SPACING } from '~/utils/design-tokens'
</script>
```

## Специальные случаи

### Вложенные блоки

Для вложенных блоков с прозрачным фоном используйте кастомные классы:

```vue
<template>
  <div class="border border-gray-200 dark:border-gray-700/50 rounded-lg bg-white dark:bg-gray-800/50 overflow-hidden shadow-sm">
    Вложенный блок
  </div>
</template>
```

### Пустые состояния

```vue
<template>
  <div class="app-card text-center py-12">
    <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
      <UIcon name="i-heroicons-inbox" class="w-8 h-8 text-gray-400" />
    </div>
    <h3 class="text-lg font-medium text-gray-900 dark:text-white">
      {{ t('common.noData') }}
    </h3>
    <p class="text-gray-500 dark:text-gray-400">
      {{ t('common.noDataDescription') }}
    </p>
  </div>
</template>
```

## Цветовая палитра

### Основные цвета

- **Primary**: Используется для основных действий и акцентов
- **Neutral**: Используется для второстепенных элементов
- **Success**: Зеленый для успешных операций
- **Warning**: Оранжевый для предупреждений
- **Error**: Красный для ошибок

### Серые оттенки

- `gray-50` - Очень светлый фон
- `gray-100` - Светлый фон
- `gray-200` - Границы
- `gray-300` - Разделители
- `gray-400` - Иконки
- `gray-500` - Вторичный текст
- `gray-600` - Основной текст (light mode)
- `gray-700` - Границы (dark mode)
- `gray-800` - Фон карточек (dark mode)
- `gray-900` - Основной текст (light mode)

## Dark Mode

Все компоненты поддерживают темную тему через классы `dark:`:

```vue
<template>
  <!-- Автоматически адаптируется к теме -->
  <div class="app-card">
    <h2 class="text-gray-900 dark:text-white">Заголовок</h2>
    <p class="text-gray-500 dark:text-gray-400">Описание</p>
  </div>
</template>
```

## Лучшие практики

### ✅ Правильно

```vue
<!-- Используйте app-card для основных карточек -->
<div class="app-card p-4">...</div>

<!-- Используйте дизайн-токены для отступов -->
<div :class="SPACING.cardGap">...</div>

<!-- Используйте UiAppCard для карточек с заголовком -->
<UiAppCard title="..." description="...">...</UiAppCard>
```

### ❌ Неправильно

```vue
<!-- НЕ используйте inline стили -->
<div class="bg-white dark:bg-gray-800 rounded-lg shadow">...</div>

<!-- НЕ используйте магические числа -->
<div class="space-y-5">...</div>

<!-- НЕ дублируйте стили -->
<div class="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">...</div>
```

## Обновление стилей

Если нужно изменить глобальные стили карточек:

1. Откройте `app/assets/css/main.css`
2. Найдите `.app-card` утилиту
3. Внесите изменения
4. Все карточки автоматически обновятся

```css
@layer utilities {
  .app-card {
    @apply bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700;
  }
  
  .app-card-hover {
    @apply hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200;
  }
}
```

## Дополнительные ресурсы

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Nuxt UI Documentation](https://ui.nuxt.com)
- [Design Tokens](./app/utils/design-tokens.ts)
- [Main CSS](./app/assets/css/main.css)
