# План реализации: Унифицированная кнопка сохранения с анимацией

## Цель
Создать единый компонент кнопки сохранения для форм на страницах (не в модалях) с визуальной обратной связью:
- При успехе: галочка с анимацией (3 сек), изменение цвета/эффект свечения
- При ошибке: иконка ошибки (3 сек), красный цвет кнопки, гарантированный тост

## Найденные формы на страницах

1. **ProjectForm** (`components/forms/ProjectForm.vue`)
   - Используется в: `pages/projects/new.vue`, `pages/projects/[id]/settings.vue`
   - Кнопка сохранения: строка 142-149

2. **PublicationForm** (`components/forms/PublicationForm.vue`)
   - Используется в: `pages/projects/[id]/publications/new.vue`, `pages/projects/[id]/publications/[publicationId].vue`
   - Кнопка сохранения: строка 429-436

3. **ChannelForm** (`components/forms/ChannelForm.vue`)
   - Используется в: `pages/projects/[id]/channels/new.vue`, `pages/projects/[id]/channels/[channelId]/settings.vue`
   - Кнопка сохранения: строка 439-446

4. **PostEditBlock** (`components/posts/PostEditBlock.vue`)
   - Используется в: `pages/projects/[id]/publications/[publicationId].vue`
   - Кнопка сохранения: строка 381-388

## Этапы реализации

### 1. Создать компонент SaveButton
**Файл**: `ui/app/components/ui/SaveButton.vue`

Функционал:
- Принимает props: `loading`, `disabled`, `label`
- Внутреннее состояние: `success`, `error`
- Методы: `showSuccess()`, `showError()`
- Анимации:
  - Успех: галочка вращается по оси Z, зеленое свечение, 3 сек
  - Ошибка: иконка предупреждения, красный цвет, 3 сек
- Автоматический возврат к нормальному состоянию через 3 сек

### 2. Обновить формы для использования SaveButton

#### ProjectForm
- Заменить UButton на SaveButton
- Добавить ref для доступа к методам кнопки
- В handleSubmit: вызвать showSuccess() при успехе, showError() при ошибке
- Добавить toast при ошибке

#### PublicationForm
- Аналогично ProjectForm

#### ChannelForm
- Аналогично ProjectForm

#### PostEditBlock
- Аналогично ProjectForm

### 3. Обновить родительские страницы

Для каждой страницы, использующей формы:
- Убедиться, что обработчики @submit/@success правильно обрабатывают успех/ошибку
- Убрать toast при успехе (если есть)
- Добавить/проверить toast при ошибке

### 4. Добавить i18n ключи

В `ru-RU.json` и `en-US.json`:
```json
{
  "common": {
    "saveSuccess": "Успешно сохранено" / "Successfully saved",
    "saveError": "Ошибка сохранения" / "Save failed"
  }
}
```

## Технические детали

### Анимации (CSS)
- Вращение галочки: `@keyframes rotateIn { from { transform: rotateZ(-180deg); opacity: 0; } to { transform: rotateZ(0); opacity: 1; } }`
- Свечение: `box-shadow` с зеленым/красным цветом
- Плавные переходы цвета кнопки

### Состояния кнопки
1. Normal: обычная primary кнопка
2. Loading: спиннер
3. Success (3 сек): зеленая, галочка, свечение
4. Error (3 сек): красная, иконка ошибки

### Иконки
- Успех: `i-heroicons-check`
- Ошибка: `i-heroicons-exclamation-circle`
