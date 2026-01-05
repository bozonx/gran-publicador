# Common UI Components

Этот директорий содержит переиспользуемые компоненты для унификации интерфейса приложения.

## Компоненты

### Формы

#### FormReadOnlyField
Унифицированное read-only поле для отображения неизменяемых данных в формах.

```vue
<CommonFormReadOnlyField
  label="Created At"
  :value="entity.createdAt"
  help="Date when entity was created"
  icon="i-heroicons-calendar"
  format-as-date
/>
```

**Props:**
- `label` (string, required) - Название поля
- `value` (string | number | null | undefined, required) - Значение
- `help` (string, optional) - Текст подсказки
- `icon` (string, optional) - Имя иконки
- `formatAsDate` (boolean, default: false) - Форматировать как дату
- `mono` (boolean, default: false) - Использовать моноширинный шрифт

### Метрики

#### MetricItem
Inline отображение метрики с иконкой и значением.

```vue
<CommonMetricItem
  icon="i-heroicons-document-text"
  label="Publications"
  :value="count"
  variant="default"
  bold
/>
```

**Props:**
- `icon` (string, required) - Имя иконки
- `label` (string, required) - Название метрики
- `value` (string | number, required) - Значение
- `variant` ('default' | 'error' | 'warning' | 'success', default: 'default') - Цветовая схема
- `bold` (boolean, default: false) - Жирный шрифт для значения

#### MetricBox
Метрика в стилизованном контейнере (для dashboard).

```vue
<CommonMetricBox
  icon="i-heroicons-signal"
  label="Channels"
  :value="channelCount"
/>
```

**Props:**
- `icon` (string, required) - Имя иконки
- `label` (string, required) - Название метрики
- `value` (string | number, required) - Значение

### Карточки

#### EntityCardHeader
Стандартный заголовок для карточек сущностей.

```vue
<CommonEntityCardHeader
  :title="project.name"
  badge="Owner"
  badge-color="primary"
>
  <template #actions>
    <!-- Custom action buttons -->
  </template>
</CommonEntityCardHeader>
```

**Props:**
- `title` (string, required) - Заголовок
- `badge` (string, optional) - Текст badge
- `badgeColor` ('error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral', optional) - Цвет badge

**Slots:**
- `actions` - Кнопки действий и индикаторы

#### CardDescription
Описание с ограничением количества строк.

```vue
<CommonCardDescription
  :text="entity.description"
  :lines="2"
/>
```

**Props:**
- `text` (string | null, optional) - Текст описания
- `lines` (number, default: 2) - Количество строк для отображения

#### CardFooter
Унифицированный footer для карточек.

```vue
<CommonCardFooter with-border spacing="normal">
  <!-- Footer content -->
</CommonCardFooter>
```

**Props:**
- `withBorder` (boolean, default: true) - Показывать верхнюю границу
- `spacing` ('compact' | 'normal' | 'spacious', default: 'normal') - Размер отступов

### Отображение данных

#### WarningBadge
Badge для отображения предупреждений и алертов.

```vue
<CommonWarningBadge
  icon="i-heroicons-exclamation-triangle"
  text="No recent posts"
  variant="warning"
/>
```

**Props:**
- `icon` (string, required) - Имя иконки
- `text` (string, required) - Текст предупреждения
- `variant` ('warning' | 'error' | 'info', default: 'warning') - Тип предупреждения

#### ChannelIcons
Отображение иконок социальных сетей каналов.

```vue
<CommonChannelIcons
  :channels="project.channels"
  :max-visible="5"
  stacked
/>
```

**Props:**
- `channels` (SimpleChannel[], required) - Массив каналов
- `maxVisible` (number, default: 5) - Максимальное количество отображаемых иконок
- `stacked` (boolean, default: true) - Стиль наложения иконок

**Type SimpleChannel:**
```typescript
interface SimpleChannel {
  id: string
  name: string
  socialMedia: string
  isStale?: boolean
}
```

#### LanguageBadges
Отображение языковых тегов.

```vue
<CommonLanguageBadges
  :languages="['en-US', 'ru-RU']"
  mode="normal"
/>
```

**Props:**
- `languages` (string[], required) - Массив кодов языков
- `mode` ('compact' | 'normal', default: 'normal') - Режим отображения

## Composables

### useFormatters

Набор утилит для форматирования данных.

```typescript
import { useFormatters } from '~/composables/useFormatters'

const { formatDateShort, formatDateWithTime, truncateContent, formatNumber } = useFormatters()
```

**Методы:**
- `formatDateShort(date: string | null | undefined): string` - Короткий формат даты
- `formatDateWithTime(date: string | null | undefined): string` - Дата со временем
- `truncateContent(content: string | null | undefined, maxLength?: number): string` - Обрезка HTML контента
- `formatNumber(value: number | null | undefined): string` - Форматирование чисел

## Принципы использования

1. **Auto-import**: Все компоненты в `/components/common/` автоматически доступны с префиксом `Common`
2. **Type Safety**: Все props строго типизированы через TypeScript
3. **Defaults**: Разумные значения по умолчанию для опциональных props
4. **Flexibility**: Используйте slots для кастомизации
5. **Consistency**: Используйте эти компоненты вместо создания дублирующего кода

## Примеры рефакторинга

### До:
```vue
<div class="space-y-2">
  <label class="block text-sm font-medium">Created At</label>
  <div class="p-3 bg-gray-50 rounded-lg border">
    <span>{{ new Date(project.createdAt).toLocaleString() }}</span>
  </div>
  <p class="text-xs text-gray-500">Creation date</p>
</div>
```

### После:
```vue
<CommonFormReadOnlyField
  label="Created At"
  :value="project.createdAt"
  help="Creation date"
  format-as-date
/>
```

## См. также

- [UI Component Unification Plan](../../.agent/tasks/ui-component-unification.md)
- [Nuxt UI Documentation](https://ui.nuxt.com)
