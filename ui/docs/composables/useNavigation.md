# Navigation Composable

## Обзор

Композабл `useNavigation` обеспечивает единое поведение кнопки "Назад" как для браузерной кнопки, так и для кнопок в интерфейсе приложения.

## Основные возможности

- **Проверка наличия истории**: Определяет, есть ли доступная история навигации
- **Единое поведение**: Браузерная и интерфейсная кнопки "Назад" работают одинаково
- **Disabled состояние**: Кнопки в интерфейсе автоматически становятся неактивными, если истории нет

## Использование

### Базовое использование

```vue
<script setup>
const { canGoBack, goBack } = useNavigation()

function handleCancel() {
  goBack()
}
</script>

<template>
  <UButton 
    :disabled="!canGoBack"
    @click="goBack"
  >
    Назад
  </UButton>
</template>
```

### В формах создания/редактирования

```vue
<script setup>
const { canGoBack, goBack } = useNavigation()

function handleSuccess() {
  // После успешного создания также используем goBack
  goBack()
}

function handleCancel() {
  goBack()
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Back button -->
    <div class="mb-6">
      <UButton
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left"
        :disabled="!canGoBack"
        @click="handleCancel"
      >
        {{ t('common.back') }}
      </UButton>
    </div>

    <FormsProjectForm 
      @submit="handleSuccess" 
      @cancel="handleCancel" 
    />
  </div>
</template>
```

## API

### canGoBack

- **Тип**: `ComputedRef<boolean>`
- **Описание**: Реактивное значение, указывающее, доступна ли история навигации для возврата назад
- **Использование**: Привязывается к атрибуту `:disabled` кнопок

### goBack()

- **Тип**: `() => void`
- **Описание**: Выполняет навигацию назад по истории браузера
- **Поведение**: 
  - Если история доступна (`canGoBack === true`), вызывает `router.back()`
  - Если истории нет, ничего не делает (кнопка должна быть disabled)

## Преимущества

1. **Консистентность**: Кнопка "Назад" в браузере и в интерфейсе работают одинаково
2. **Пользовательский опыт**: Навигация учитывает реальный путь пользователя
3. **Безопасность**: Кнопки автоматически становятся неактивными при отсутствии истории
4. **Простота**: Минимум кода для реализации правильного поведения

## Примеры обновлённых страниц

Все следующие страницы используют `useNavigation`:

- `/pages/projects/new.vue` - Создание проекта
- `/pages/projects/[id]/index.vue` - Детали проекта
- `/pages/projects/[id]/settings.vue` - Настройки проекта
- `/pages/projects/[id]/channels/new.vue` - Создание канала
- `/pages/projects/[id]/channels/[channelId]/index.vue` - Детали канала
- `/pages/projects/[id]/channels/[channelId]/settings.vue` - Настройки канала
- `/pages/projects/[id]/publications/new.vue` - Создание публикации
- `/pages/projects/[id]/publications/index.vue` - Список публикаций
- `/pages/projects/[id]/publications/[publicationId].vue` - Редактирование публикации
- `/pages/projects/[id]/posts/new.vue` - Создание поста
- `/pages/projects/[id]/posts/index.vue` - Список постов
- `/pages/projects/[id]/posts/[postId].vue` - Детали поста

## Миграция с hardcoded путей

### Было:

```vue
<script setup>
const router = useRouter()

function handleCancel() {
  router.push('/projects')
}
</script>

<template>
  <UButton @click="handleCancel">
    Назад
  </UButton>
</template>
```

### Стало:

```vue
<script setup>
const { canGoBack, goBack } = useNavigation()

function handleCancel() {
  goBack()
}
</script>

<template>
  <UButton 
    :disabled="!canGoBack"
    @click="goBack"
  >
    Назад
  </UButton>
</template>
```

## Технические детали

Композабл использует `window.history.state.back` для определения наличия истории:

```typescript
const canGoBack = computed(() => {
  return window.history.state?.back !== null && 
         window.history.state?.back !== undefined
})
```

Это позволяет точно определить, была ли предыдущая страница в текущей сессии браузера.
