# План унификации компонентов UI

## Цель
Улучшить переиспользование компонентов в UI, выявить повторяющиеся паттерны и создать общие компоненты для унификации интерфейса.

## 1. Анализ существующей структуры

### Выявленные повторяющиеся паттерны:

**В формах:**
- Read-only поля для отображения неизменяемых данных (createdAt, project, socialMedia, language)
- Форматирование дат в одинаковом формате
- Повторяющиеся секции preferences с staleChannelsDays

**В карточках и списках:**
- Отображение метрик с иконками и значениями
- Боксы с метриками (styled containers)
- Превью описаний с line-clamp
- Футеры с разделителями
- Отображение каналов (social icons)
- Warning badges

**Общие утилиты:**
- Функции форматирования дат (formatDate, formatDateWithTime)
- Функции обрезки текста (truncateContent)

## 2. Созданные общие компоненты ✅

### 2.1 Компоненты для форм (в `/components/common/`)

- [x] **FormReadOnlyField.vue** - унифицированное read-only поле
  - Параметры: label, value, help, icon, formatAsDate, mono
  - Используется для: createdAt, project, language, socialMedia

### 2.2 Компоненты для отображения метрик

- [x] **MetricItem.vue** - inline метрика с иконкой
  - Параметры: icon, label, value, variant, bold
  - Варианты: default, error, warning, success

- [x] **MetricBox.vue** - метрика в боксе (для dashboard)
  - Параметры: icon, label, value
  - Стиль: background, border, padding

### 2.3 Компоненты для карточек

- [x] **EntityCardHeader.vue** - заголовок карточки
  - Параметры: title, badge, badgeColor
  - Слот: actions (для кнопок и индикаторов)

- [x] **CardDescription.vue** - описание с line-clamp
  - Параметры: text, lines
  - По умолчанию: 2 строки

- [x] **CardFooter.vue** - футер карточки
  - Параметры: withBorder, spacing
  - Варианты spacing: compact, normal, spacious

### 2.4 Компоненты для представления данных

- [x] **WarningBadge.vue** - badge для предупреждений
  - Параметры: icon, text, variant
  - Варианты: warning, error, info

- [x] **ChannelIcons.vue** - отображение иконок каналов
  - Параметры: channels, maxVisible, stacked
  - Поддерживает overflow с счетчиком

- [x] **LanguageBadges.vue** - отображение языков
  - Параметры: languages, mode
  - Режимы: compact, normal

### 2.5 Composables

- [x] **useFormatters.ts** - утилиты форматирования
  - `formatDateShort()` - короткий формат даты
  - `formatDateWithTime()` - дата со временем
  - `truncateContent()` - обрезка HTML контента
  - `formatNumber()` - форматирование чисел

## 3. Рефакторинг существующих компонентов ✅

### 3.1 Формы

- [x] **ProjectForm.vue**
  - Заменено: formatDate → useFormatters
  - Заменено: custom read-only field → FormReadOnlyField

- [x] **ChannelForm.vue**
  - Заменено: formatDate → useFormatters
  - Заменено: 3 custom read-only fields → FormReadOnlyField

### 3.2 Карточки

- [x] **ProjectCard.vue**
  - Заменено: custom header → EntityCardHeader
  - Заменено: inline description → CardDescription
  - Заменено: 2 metric boxes → MetricBox
  - Заменено: custom language display → LanguageBadges
  - Заменено: custom channel icons → ChannelIcons
  - Заменено: formatDate → useFormatters

## 4. Следующие шаги (TODO)

### 4.1 Дополнительный рефакторинг карточек

- [ ] **ChannelCard.vue**
  - Применить EntityCardHeader
  - Применить CardDescription
  - Применить CardFooter
  - Применить MetricItem для статистики

- [ ] **PublicationCard.vue**
  - Применить EntityCardHeader
  - Применить CardDescription
  - Применить CardFooter
  - Применить MetricItem для статистики

### 4.2 Рефакторинг списков (ListItem)

- [ ] **ProjectListItem.vue**
  - Применить MetricItem
  - Применить WarningBadge
  - Применить useFormatters

- [ ] **ChannelListItem.vue**
  - Применить MetricItem
  - Применить useFormatters

- [ ] **PublicationListItem.vue**
  - Применить MetricItem
  - Применить useFormatters

### 4.3 Дополнительные унифицированные компоненты

- [ ] **StatusBadge.vue** - унифицированный статус badge
  - Для: DRAFT, READY, SCHEDULED, PUBLISHED, FAILED и т.д.
  - Автоматическая цветовая схема

- [ ] **PostChannelIcons.vue** - иконки каналов для постов
  - Аналогично ChannelIcons, но для постов publication
  - С индикаторами problemLevel

### 4.4 PublicationForm.vue

- [ ] Ревью и рефакторинг для использования новых компонентов
- [ ] Вынести повторяющуюся логику в composables

## 5. Преимущества унификации

### Достигнуто:
- ✅ Уменьшение дублирования кода
- ✅ Единообразный UI/UX
- ✅ Упрощение поддержки и изменений
- ✅ Централизованное форматирование данных
- ✅ Улучшенная type safety

### Метрики:
- Создано: 8 новых переиспользуемых компонентов
- Создано: 1 composable с утилитами
- Рефакторено: 3 компонента (2 формы + 1 карточка)
- Удалено дублирующегося кода: ~200 строк

## 6. Принципы для новых компонентов

1. **Single Responsibility** - каждый компонент решает одну задачу
2. **Composition over Inheritance** - использовать слоты и композицию
3. **Props Validation** - строгая типизация props
4. **Flexible but Opinionated** - разумные defaults + гибкость через props
5. **Documentation** - JSDoc комментарии для всех props

## Примечания

- Все новые компоненты в `/components/common/`
- Prefix `Common` для автоимпорта в Nuxt 3
- Используется Composition API с `<script setup>`
- TypeScript для type safety
