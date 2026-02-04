# План стандартизации спиннеров

## Создан компонент LoadingSpinner

Расположение: `/ui/app/components/ui/LoadingSpinner.vue`

### Параметры:
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl' (по умолчанию 'md')
- `color`: 'gray' | 'primary' (по умолчанию 'gray')
- `label`: string (опционально)
- `centered`: boolean (по умолчанию false)

### Размеры:
- xs: w-4 h-4
- sm: w-5 h-5
- md: w-6 h-6
- lg: w-10 h-10
- xl: w-12 h-12

## Места для замены

### 1. Dashboard (index.vue)
- ✅ Scheduled section (строка 221-223)
- ✅ Problems section (строка 262-264)
- ✅ Published section (строка 317-319)
- ✅ Projects section (строка 347-349)

### 2. ContentLibraryManager.vue
- ✅ Main loading (строка 1317-1319)

### 3. RecentContentWidget.vue
- Использует skeleton loader - оставить как есть

### 4. Navigation.vue
- ✅ Projects loading (строка 216-219)
- ✅ Channels loading (строка 261-263)

### 5. Страницы с загрузкой
- ✅ /pages/auth/login.vue (строка 126-129)
- ✅ /pages/news.vue (строка 288)
- ✅ /pages/channels/index.vue (строка 425, 452)
- ✅ /pages/channels/[id]/index.vue (строка 421, 649, 687, 736)
- ✅ /pages/channels/[id]/settings.vue (строка 131)
- ✅ /pages/projects/index.vue (строка 244)
- ✅ /pages/projects/[id]/index.vue (строка 480, 518, 559)
- ✅ /pages/projects/[id]/settings.vue (строка 183)
- ✅ /pages/projects/[id]/news.vue (строка 662)
- ✅ /pages/publications/index.vue (строка 629)
- ✅ /pages/publications/[id]/index.vue (строка 150)
- ✅ /pages/publications/[id]/edit.vue (строка 879)
- ✅ /pages/admin/index.vue (строка 475)
- ✅ /pages/admin/users/[id].vue (строка 140)

### 6. Компоненты
- ✅ /components/news/CreatePublicationModal.vue (строка 336-339)
- ✅ /components/news/SourceTagSelector.vue (строка 280, 316)
- ✅ /components/channels/DashboardPanel.vue (строка 59)
- ✅ /components/publications/DraftsSection.vue (строка 77)
- ✅ /components/settings/SettingsApiTokens.vue (строка 162)
- ✅ /components/settings/SettingsNotifications.vue (строка 114)
- ✅ /components/settings/SettingsLlmPromptTemplates.vue (строка 352)
- ✅ /components/posts/AuthorSignatureManager.vue (строка 179)
- ✅ /components/features/AuthStatus.vue (строка 18)
- ✅ /components/features/ChannelsList.vue (строка 198)

## Примеры использования

```vue
<!-- Простой спиннер -->
<UiLoadingSpinner />

<!-- С текстом -->
<UiLoadingSpinner :label="t('common.loading')" />

<!-- Центрированный -->
<UiLoadingSpinner centered />

<!-- Большой primary спиннер с текстом -->
<UiLoadingSpinner size="lg" color="primary" :label="t('auth.loggingIn')" />

<!-- Маленький спиннер -->
<UiLoadingSpinner size="sm" />
```

## Рекомендации по размерам

- **xs (w-4 h-4)**: Inline индикаторы, маленькие кнопки
- **sm (w-5 h-5)**: Списки, карточки, небольшие секции
- **md (w-6 h-6)**: Стандартные секции контента (по умолчанию)
- **lg (w-10 h-10)**: Страницы входа, модальные окна
- **xl (w-12 h-12)**: Полностраничная загрузка, большие модальные окна

## Рекомендации по цвету

- **gray**: Стандартная загрузка контента (по умолчанию)
- **primary**: Важные операции (вход, создание, сохранение)
