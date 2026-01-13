# Система валідації постів для соціальних мереж

## Що було створено

### 1. Серверна частина (Backend)

#### Файли:
- `src/common/validators/social-media-validation.constants.ts` - Константи з правилами валідації для кожної соціальної мережі
- `src/common/validators/social-media-validation.validator.ts` - Функції валідації контенту
- `src/common/validators/is-social-media-content-valid.validator.ts` - NestJS декоратор для валідації в DTO
- `src/common/validators/index.ts` - Оновлено для експорту нових валідаторів

#### Правила валідації для Telegram:
- Максимальна довжина текстового поста: **4096 символів**
- Максимальна довжина caption (підпису до медіа): **1024 символи**
- Максимальна кількість медіа-файлів: **10 файлів**

#### Правила для інших платформ:
- **VK**: текст 16384, caption 16384, медіа 10
- **YouTube**: текст 5000, caption 5000, медіа 1 (обов'язково)
- **TikTok**: текст 2200, caption 2200, медіа 1 (обов'язково)
- **Facebook**: текст 63206, caption 63206, медіа 10
- **SITE**: текст 100000, caption 100000, медіа 50

### 2. Клієнтська частина (Frontend)

#### Файли:
- `ui/app/composables/useSocialMediaValidation.ts` - Vue composable для валідації на клієнті
- `ui/i18n/locales/ru-RU.json` - Додано переклади помилок валідації (російська)
- `ui/i18n/locales/en-US.json` - Додано переклади помилок валідації (англійська)

#### Функціонал composable:
- `validatePostContent()` - Валідація контенту та медіа
- `getContentLength()` - Підрахунок довжини тексту (без HTML тегів)
- `getRemainingCharacters()` - Скільки символів залишилось
- `getValidationRules()` - Отримання правил для конкретної платформи

### 3. Документація

#### Файли:
- `dev_docs/social-media-validation.md` - Повна документація системи валідації
- `dev_docs/post-edit-block-validation-integration.js` - Приклад інтеграції в компонент

## Як використовувати

### На сервері (NestJS)

```typescript
import { IsSocialMediaContentValid } from '../../common/validators';

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  @IsSocialMediaContentValid()
  public content?: string | null;
  
  // Додайте поле для підрахунку медіа
  public mediaCount?: number;
  public socialMedia?: string;
}
```

### На клієнті (Vue)

```vue
<script setup lang="ts">
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'

const { validatePostContent, getRemainingCharacters } = useSocialMediaValidation()

const validationResult = computed(() => {
  return validatePostContent(
    content.value,
    mediaCount.value,
    channel.value.socialMedia
  )
})
</script>

<template>
  <!-- Показати помилки -->
  <UAlert v-if="!validationResult.isValid" color="error">
    <li v-for="error in validationResult.errors">
      {{ error.message }}
    </li>
  </UAlert>
</template>
```

## Наступні кроки для інтеграції

### 1. Інтеграція в форму редагування поста

Відкрийте `ui/app/components/posts/PostEditBlock.vue` та додайте код з файлу:
`dev_docs/post-edit-block-validation-integration.js`

### 2. Інтеграція в форму створення/редагування публікації

Відкрийте `ui/app/pages/publications/[id]/edit.vue` та додайте аналогічну логіку.

### 3. Серверна валідація

Додайте декоратор `@IsSocialMediaContentValid()` в DTO:
- `src/modules/posts/dto/create-post.dto.ts`
- `src/modules/posts/dto/update-post.dto.ts`
- `src/modules/publications/dto/create-publication.dto.ts`
- `src/modules/publications/dto/update-publication.dto.ts`

**Важливо**: Для роботи декоратора потрібно, щоб в об'єкті були поля:
- `socialMedia` - платформа
- `content` - контент
- `mediaCount` - кількість медіа (можна обчислити на сервері)

## Особливості реалізації

### Caption vs Text

Система автоматично визначає, що валідувати:
- Якщо `mediaCount > 0` → валідується як **caption** (підпис до медіа)
- Якщо `mediaCount === 0` → валідується як **текстовий пост**

### Видалення HTML тегів

При підрахунку довжини тексту HTML теги видаляються:
```typescript
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}
```

### Синхронізація правил

Правила валідації дубльовані в двох місцях:
1. **Сервер**: `src/common/validators/social-media-validation.constants.ts`
2. **Клієнт**: `ui/app/composables/useSocialMediaValidation.ts`

При зміні правил потрібно оновлювати обидва файли!

## Тестування

### Перевірка на клієнті:
1. Створіть публікацію з довгим текстом (>4096 символів для Telegram)
2. Додайте медіа-файли
3. Перевірте, що з'являються помилки валідації
4. Перевірте лічильник символів

### Перевірка на сервері:
1. Спробуйте створити пост через API з невалідними даними
2. Перевірте, що сервер повертає помилку валідації

## Розширення системи

Для додавання нової соціальної мережі:

1. Додайте правила в `SOCIAL_MEDIA_VALIDATION_RULES` (обидва файли)
2. Переклади додаються автоматично (платформа передається як параметр)
3. Оновіть документацію

## Відомі обмеження

1. Правила дубльовані на клієнті та сервері
2. Декоратор `@IsSocialMediaContentValid()` вимагає наявності полів `socialMedia` та `mediaCount` в об'єкті
3. Валідація працює тільки для текстового контенту, не для медіа-файлів (розмір, формат тощо)

## Автор

Створено за допомогою AI Assistant для проекту Gran Publicador.
