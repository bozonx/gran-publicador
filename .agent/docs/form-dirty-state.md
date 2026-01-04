# Form Dirty State Tracking

Система отслеживания несохраненных изменений в формах.

## Компоненты

### 1. `useFormDirtyState` (Composable)

Composable для отслеживания изменений в формах.

**Использование:**

```typescript
const formData = reactive({
  name: '',
  description: '',
})

const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(formData)

// После загрузки данных или успешного сохранения
saveOriginalState()

// Для сброса к исходному состоянию
resetToOriginal()
```

**API:**

- `isDirty` - computed boolean, true если есть несохраненные изменения
- `saveOriginalState()` - сохранить текущее состояние как "чистое"
- `resetToOriginal()` - сбросить форму к последнему сохраненному состоянию

**Опции:**

```typescript
useFormDirtyState(formData, {
  enableBeforeUnload: true, // Предупреждение браузера при закрытии вкладки
  enableNavigationGuard: true, // Предупреждение при навигации через Vue Router
  compareFn: (original, current) => { /* custom comparison */ }
})
```

### 2. `FormActions.vue` (Component)

Компонент для отображения кнопок действий формы с автоматическим показом кнопки Reset.

**Props:**

- `loading` - форма в процессе сохранения
- `disabled` - кнопка Save отключена
- `isDirty` - есть несохраненные изменения (показывает Reset)
- `saveLabel` - текст кнопки Save
- `resetLabel` - текст кнопки Reset
- `cancelLabel` - текст кнопки Cancel
- `hideCancel` - скрыть кнопку Cancel
- `showBorder` - показать верхнюю границу

**Events:**

- `@reset` - пользователь нажал Reset
- `@cancel` - пользователь нажал Cancel

**Методы (через ref):**

- `showSuccess()` - показать анимацию успеха
- `showError()` - показать анимацию ошибки

## Интеграция в форму

### Пример полной интеграции:

```vue
<script setup lang="ts">
const formData = reactive({
  name: '',
  description: '',
})

const formActionsRef = ref(null)

// 1. Инициализация dirty state (navigation guard настраивается автоматически)
const { isDirty, saveOriginalState, resetToOriginal } = useFormDirtyState(formData)

// 2. Сохранение исходного состояния после загрузки
watch(() => props.data, (newData) => {
  formData.name = newData.name
  formData.description = newData.description
  nextTick(() => {
    saveOriginalState()
  })
}, { immediate: true })

// 3. Обработчик сохранения
async function handleSubmit() {
  try {
    await saveData(formData)
    formActionsRef.value?.showSuccess()
    // Обновить исходное состояние после успешного сохранения
    saveOriginalState()
  } catch (error) {
    formActionsRef.value?.showError()
  }
}

// 4. Обработчик сброса
function handleReset() {
  resetToOriginal()
}

// Navigation guard настраивается автоматически в composable!
// Не нужно добавлять onBeforeRouteLeave вручную
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <!-- Поля формы -->
    
    <UiFormActions
      ref="formActionsRef"
      :loading="isLoading"
      :disabled="!isValid"
      :is-dirty="isDirty"
      @reset="handleReset"
      @cancel="handleCancel"
    />
  </form>
</template>
```

## Применено в формах

- ✅ `ProjectForm.vue` - форма проекта
- ✅ `ChannelForm.vue` - форма канала
- ✅ `PublicationForm.vue` - форма публикации

## i18n ключи

Добавлены в `ru-RU.json` и `en-US.json`:

```json
{
  "form": {
    "unsavedChanges": "Несохраненные изменения",
    "resetConfirm": "Вы уверены, что хотите сбросить все изменения?"
  }
}
```

## Поведение

1. **Визуальная индикация**: При изменении формы появляется кнопка "Reset" и индикатор "Unsaved changes"
2. **Сброс изменений**: Кнопка Reset возвращает форму к последнему сохраненному состоянию
3. **Предупреждение при навигации**: При попытке уйти со страницы с несохраненными изменениями появляется подтверждение
4. **Предупреждение браузера**: При попытке закрыть вкладку/окно браузера с несохраненными изменениями появляется стандартное предупреждение браузера
