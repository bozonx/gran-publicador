# План унификации визуального стиля UI

## Цель
Привести все компоненты к единому визуальному стилю с использованием дизайн-токенов и согласованных утилит.

## Текущие проблемы

### 1. Несогласованность карточек
- **Проблема**: Три разных подхода к стилизации карточек
  - Утилиты `app-card` (правильно)
  - Inline классы (неправильно)
  - Старый компонент `UiCard.vue` (устарел)
  
- **Решение**: 
  - Использовать только утилиты `app-card` и `app-card-hover`
  - Удалить устаревший `UiCard.vue`
  - Обновить все компоненты для использования единого подхода

### 2. Несогласованные отступы
- **Проблема**: Разные значения padding (p-4, p-5, p-6)
- **Решение**: Стандартизировать:
  - Карточки: `p-4` (16px)
  - Модальные окна и формы: `p-6` (24px)
  - Компактные элементы: `p-3` (12px)

### 3. Несогласованные цвета границ
- **Проблема**: 
  - `border-gray-200 dark:border-gray-700`
  - `border-gray-100 dark:border-gray-700/50`
  
- **Решение**: Стандартизировать на:
  - Основные границы: `border-gray-200 dark:border-gray-700`
  - Тонкие разделители: `border-gray-100 dark:border-gray-700/50`

### 4. Несогласованные фоны
- **Проблема**:
  - `bg-white dark:bg-gray-800`
  - `bg-white dark:bg-gray-800/50`
  
- **Решение**: Стандартизировать на:
  - Карточки: `bg-white dark:bg-gray-800` (через app-card)
  - Вложенные элементы: `bg-gray-50 dark:bg-gray-800/50`

## Дизайн-токены

### Расширить design-tokens.ts
```typescript
export const CARD_STYLES = {
  // Base card classes (уже есть в CSS как app-card)
  base: 'app-card',
  hover: 'app-card-hover',
  
  // Padding variants
  paddingCompact: 'p-3',
  paddingNormal: 'p-4',
  paddingSpacious: 'p-6',
  
  // Border variants
  borderPrimary: 'border-gray-200 dark:border-gray-700',
  borderSubtle: 'border-gray-100 dark:border-gray-700/50',
} as const

export const SPACING = {
  // Vertical spacing
  sectionGap: 'space-y-8',
  cardGap: 'space-y-6',
  fieldGap: 'space-y-4',
  compactGap: 'space-y-3',
  tightGap: 'space-y-2',
  
  // Margins
  sectionMargin: 'mb-8',
  cardMargin: 'mb-6',
  fieldMargin: 'mb-4',
} as const
```

## План действий

### Этап 1: Обновить design-tokens.ts
- [x] Добавить CARD_STYLES
- [x] Добавить SPACING
- [x] Документировать использование

### Этап 2: Обновить main.css
- [x] Убедиться что app-card использует правильные цвета
- [x] Добавить варианты если нужно

### Этап 3: Обновить компоненты карточек
- [ ] `PublicationCard.vue` - заменить inline классы на app-card
- [ ] `PublicationListItem.vue` - заменить inline классы на app-card
- [ ] Удалить `UiCard.vue` (устарел)
- [ ] Проверить все использования

### Этап 4: Обновить компоненты форм
- [ ] `ChannelCredentialsFields.vue` - стандартизировать spacing
- [ ] Все формы - использовать FORM_SPACING

### Этап 5: Обновить страницы
- [ ] `index.vue` - стандартизировать карточки секций
- [ ] `channels/[id]/settings.vue` - проверить использование UiAppCard

### Этап 6: Проверка и тестирование
- [ ] Визуальная проверка всех страниц
- [ ] Проверка dark mode
- [ ] Проверка responsive

## Приоритеты

1. **Высокий**: Карточки (Card components)
2. **Высокий**: Списки (List items)
3. **Средний**: Формы (Forms)
4. **Средний**: Страницы (Pages)
5. **Низкий**: Мелкие компоненты

## Критерии успеха

- ✅ Все карточки используют app-card утилиты
- ✅ Единые отступы везде
- ✅ Единые цвета границ
- ✅ Единые фоны
- ✅ Нет inline стилей для базовых элементов
- ✅ Все используют design-tokens где возможно
