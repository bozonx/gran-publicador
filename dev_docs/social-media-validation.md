# Валідація постів для соціальних мереж

## Огляд

Система валідації постів забезпечує перевірку контенту та медіа-файлів відповідно до обмежень різних соціальних мереж.

## Серверна частина

### Константи валідації

Файл: `src/common/validators/social-media-validation.constants.ts`

Містить правила валідації для кожної соціальної мережі:
- `maxTextLength` - максимальна довжина текстового поста
- `maxCaptionLength` - максимальна довжина підпису (caption) коли є медіа
- `maxMediaCount` - максимальна кількість медіа-файлів
- `minMediaCount` - мінімальна кількість медіа-файлів (опціонально)

#### Telegram
- Текст: 4096 символів
- Caption: 1024 символи
- Медіа: до 10 файлів

### Валідатор

Файл: `src/common/validators/social-media-validation.validator.ts`

Функція `validatePostContent()` перевіряє:
1. Довжину контенту (текст або caption залежно від наявності медіа)
2. Кількість медіа-файлів
3. Мінімальну кількість медіа (якщо потрібно)

### NestJS Decorator

Файл: `src/common/validators/is-social-media-content-valid.validator.ts`

Декоратор `@IsSocialMediaContentValid()` для використання в DTO:

```typescript
import { IsSocialMediaContentValid } from '../../common/validators';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  public socialMedia!: string;

  @IsString()
  @IsOptional()
  @IsSocialMediaContentValid()
  public content?: string | null;

  // Додайте поле mediaCount для валідації
  public mediaCount?: number;
}
```

## Клієнтська частина

### Composable

Файл: `ui/app/composables/useSocialMediaValidation.ts`

#### Використання

```vue
<script setup lang="ts">
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'

const { 
  validatePostContent, 
  getContentLength, 
  getRemainingCharacters 
} = useSocialMediaValidation()

const selectedChannel = ref(/* ... */)
const content = ref('')
const mediaCount = ref(0)

// Валідація
const validationResult = computed(() => {
  if (!selectedChannel.value?.socialMedia) {
    return { isValid: true, errors: [] }
  }
  
  return validatePostContent(
    content.value,
    mediaCount.value,
    selectedChannel.value.socialMedia
  )
})

// Довжина контенту
const contentLength = computed(() => {
  return getContentLength(content.value)
})

// Залишилось символів
const remainingCharacters = computed(() => {
  if (!selectedChannel.value?.socialMedia) return null
  
  return getRemainingCharacters(
    content.value,
    mediaCount.value,
    selectedChannel.value.socialMedia
  )
})
</script>

<template>
  <div>
    <!-- Відображення помилок валідації -->
    <UAlert
      v-if="!validationResult.isValid"
      color="error"
      variant="soft"
      class="mb-4"
    >
      <ul>
        <li v-for="error in validationResult.errors" :key="error.field">
          {{ error.message }}
        </li>
      </ul>
    </UAlert>

    <!-- Лічильник символів -->
    <div v-if="remainingCharacters !== null" class="text-sm">
      <span :class="remainingCharacters < 0 ? 'text-red-500' : 'text-gray-500'">
        {{ contentLength }} / {{ contentLength + remainingCharacters }}
        ({{ remainingCharacters }} залишилось)
      </span>
    </div>
  </div>
</template>
```

### Інтеграція в PostEditBlock.vue

Додайте після імпортів:

```typescript
import { useSocialMediaValidation } from '~/composables/useSocialMediaValidation'
```

Додайте після ініціалізації composables:

```typescript
// Social media validation
const { validatePostContent, getContentLength, getRemainingCharacters } = useSocialMediaValidation()

const mediaCount = computed(() => {
    return props.publication?.media?.length || 0
})

const validationResult = computed(() => {
    if (!selectedChannel.value?.socialMedia) {
        return { isValid: true, errors: [] }
    }
    
    const content = displayContent.value
    return validatePostContent(
        content,
        mediaCount.value,
        selectedChannel.value.socialMedia as any
    )
})

const contentLength = computed(() => {
    return getContentLength(displayContent.value)
})

const remainingCharacters = computed(() => {
    if (!selectedChannel.value?.socialMedia) return null
    
    return getRemainingCharacters(
        displayContent.value,
        mediaCount.value,
        selectedChannel.value.socialMedia as any
    )
})
```

Додайте в template після редактора контенту:

```vue
<!-- Validation Errors -->
<UAlert
  v-if="!validationResult.isValid"
  color="error"
  variant="soft"
  class="mt-2"
>
  <ul class="list-disc list-inside">
    <li v-for="error in validationResult.errors" :key="error.field">
      {{ error.message }}
    </li>
  </ul>
</UAlert>

<!-- Character Counter -->
<div v-if="remainingCharacters !== null" class="mt-2 text-sm flex items-center gap-2">
  <span class="text-gray-500">
    {{ t('editor.characters') }}: {{ contentLength }}
  </span>
  <span 
    :class="remainingCharacters < 0 ? 'text-red-500 font-medium' : 'text-gray-400'"
  >
    ({{ remainingCharacters >= 0 ? '+' : '' }}{{ remainingCharacters }})
  </span>
</div>
```

## Переклади

Додано переклади в `ui/i18n/locales/ru-RU.json` та `en-US.json`:

```json
"validation": {
  "socialMedia": {
    "captionTooLong": "Длина подписи ({current}) превышает максимально допустимую ({max}) для {platform}",
    "textTooLong": "Длина текста ({current}) превышает максимально допустимую ({max}) для {platform}",
    "tooManyMedia": "Количество медиа ({current}) превышает максимально допустимое ({max}) для {platform}",
    "notEnoughMedia": "Количество медиа ({current}) меньше минимально необходимого ({min}) для {platform}"
  }
}
```

## Тестування

### Серверна частина

```typescript
import { validatePostContent } from './social-media-validation.validator';
import { SocialMedia } from '../../generated/prisma/enums';

const result = validatePostContent({
  content: 'Test content',
  mediaCount: 1,
  socialMedia: SocialMedia.TELEGRAM
});

console.log(result.isValid); // true/false
console.log(result.errors); // array of error messages
```

### Клієнтська частина

Перевірте в браузері:
1. Створіть пост з довгим текстом
2. Додайте медіа-файли
3. Перевірте відображення помилок валідації
4. Перевірте лічильник символів

## Розширення

Для додавання нових соціальних мереж:

1. Додайте правила в `SOCIAL_MEDIA_VALIDATION_RULES` (обидва файли: серверний та клієнтський)
2. Переклади додаються автоматично (використовується платформа як параметр)
