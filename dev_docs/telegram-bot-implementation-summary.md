# Telegram Bot Menu System - Implementation Summary

## ✅ Реализовано

### 1. Сервисы и инфраструктура

**TelegramSessionService** (`src/modules/telegram-bot/telegram-session.service.ts`)
- Управление сессиями пользователей в Redis
- Fallback на in-memory хранилище если Redis недоступен
- TTL для автоматического истечения сессий
- Методы: `setSession`, `getSession`, `deleteSession`, `updateMetadata`

**TelegramContentHelper** (`src/modules/telegram-bot/telegram-content.helper.ts`)
- Извлечение текста из сообщений Telegram
- Извлечение медиа (фото, видео, документы, аудио)
- Определение репостов/форвардов
- Форматирование источников для sourceTexts
- Утилиты для truncate текста

### 2. Обновленные модули

**TelegramBotModule** (`src/modules/telegram-bot/telegram-bot.module.ts`)
- Добавлены зависимости: `PublicationsModule`, `MediaModule`
- Добавлен провайдер: `TelegramSessionService`

**TelegramBotUpdate** (`src/modules/telegram-bot/telegram-bot.update.ts`)
- Полностью переписан с новой логикой
- Валидация пользователей (проверка на существование и бан)
- Обработчик `/start` - создание/приветствие пользователя
- Обработчик сообщений - роутинг по меню
- Обработчик callback queries - кнопки Done/Cancel
- Меню HOME - создание черновика
- Меню COLLECT - добавление контента в черновик

**TelegramBotService** (`src/modules/telegram-bot/telegram-bot.service.ts`)
- Добавлен обработчик `callback_query:data` для inline кнопок

### 3. Конфигурация

**AppConfig** (`src/config/app.config.ts`)
- `telegramSessionTtlMinutes` - TTL сессий (по умолчанию 10 минут)
- `frontendUrl` - URL фронтенда для ссылок в сообщениях

**Environment Variables** (`.env.development.example`, `.env.production.example`)
```bash
TELEGRAM_SESSION_TTL_MINUTES=10
FRONTEND_URL="http://localhost:3000"
```

### 4. Интернационализация

**i18n ключи** (`src/i18n/*/telegram.json`)
- `welcome_new` - приветствие нового пользователя
- `welcome_existing` - приветствие существующего пользователя
- `user_not_found` - пользователь не найден
- `user_banned` - пользователь забанен
- `draft_created` - черновик создан
- `draft_updated` - черновик обновлен
- `draft_completed` - черновик завершен
- `draft_cancelled` - черновик отменен
- `error_publication_not_found` - публикация не найдена
- `error_session_expired` - сессия истекла
- `error_creating_draft` - ошибка создания черновика
- `button_done` - кнопка "Готово"
- `button_cancel` - кнопка "Отменить"

## Логика работы

### Команда /start
1. Проверяет существование пользователя
2. Создает нового или обновляет существующего
3. Очищает активную сессию (если есть)
4. Отправляет приветственное сообщение

### Получение сообщения (без активной сессии) → HOME Menu
1. Валидирует пользователя (существует и не забанен)
2. Извлекает контент (текст + медиа)
3. Создает черновик публикации:
   - Статус: DRAFT
   - Язык: из Telegram или en-US
   - Контент: текст сообщения
   - SourceTexts: массив с первым текстом
   - Meta: информация о Telegram источнике
4. Создает Media записи для всех медиа файлов (TELEGRAM storage)
5. Связывает медиа с публикацией через PublicationMedia
6. Создает сессию в Redis
7. Отправляет сообщение с inline кнопками (Done/Cancel)
8. Переходит в меню COLLECT

### Получение сообщения (с активной сессией) → COLLECT Menu
1. Валидирует пользователя
2. Проверяет существование публикации
3. Извлекает контент из нового сообщения
4. Добавляет текст в sourceTexts массив
5. Создает и прикрепляет новые медиа файлы
6. Обновляет метаданные сессии
7. Редактирует сообщение меню с обновленной статистикой

### Кнопка "Done"
1. Удаляет сессию из Redis
2. Формирует ссылку на публикацию в UI
3. Отправляет сообщение с ссылкой
4. Возвращает в состояние "без меню"

### Кнопка "Cancel"
1. Удаляет публикацию из БД (каскадно удаляет медиа)
2. Удаляет сессию из Redis
3. Отправляет сообщение об отмене
4. Возвращает в состояние "без меню"

## Особенности реализации

### Медиа обработка
- Поддерживаются: фото, видео, документы, аудио, голосовые сообщения
- Используется `StorageType.TELEGRAM` - храним только file_id
- Для фото выбирается самое большое разрешение
- Сохраняются метаданные: filename, mimeType, fileSize

### Source Texts формат
```typescript
{
  content: string,
  order: number,
  source: "telegram:{chatId},{messageId}" | "telegram:forward" | ...
}
```

### Репосты/Форварды
- Определяются через `message.forward_origin`
- Сохраняется информация об оригинальном источнике в meta
- Для каналов сохраняется chat.id и message_id

### Сессии в Redis
- Ключ: `telegram:session:{telegramUserId}`
- TTL: настраивается через `TELEGRAM_SESSION_TTL_MINUTES`
- Автоматический fallback на in-memory если Redis недоступен
- При каждом обновлении TTL сбрасывается

### Язык публикации
- Берется из `from.language_code` Telegram пользователя
- Fallback на `en-US` если не указан
- Используется для i18n сообщений бота

## Что НЕ реализовано (Phase 5)

- ⏳ Unit тесты для новых сервисов
- ⏳ E2E тесты для flow создания черновика
- ⏳ Расширенное логирование и мониторинг

## Важные замечания

1. **Нет лимитов**: По запросу пользователя убраны все ограничения на количество source texts и медиа
2. **Только личные черновики**: Публикации создаются без projectId (личные)
3. **Безопасность**: Валидация пользователя на каждое сообщение
4. **Graceful degradation**: Fallback на in-memory если Redis недоступен
5. **i18n**: Все сообщения локализованы (ru-RU, en-US)

## Тестирование

Для тестирования нужно:
1. Установить `TELEGRAM_BOT_TOKEN` в `.env`
2. Установить `TELEGRAM_BOT_ENABLED=true`
3. Установить `FRONTEND_URL` для корректных ссылок
4. Убедиться что Redis запущен (или будет использован in-memory)
5. Запустить бота и отправить `/start`
6. Отправить сообщение или репост
7. Проверить создание черновика в UI

## Файлы

Созданные:
- `src/modules/telegram-bot/telegram-session.service.ts`
- `src/modules/telegram-bot/telegram-content.helper.ts`

Обновленные:
- `src/modules/telegram-bot/telegram-bot.module.ts`
- `src/modules/telegram-bot/telegram-bot.update.ts`
- `src/modules/telegram-bot/telegram-bot.service.ts`
- `src/config/app.config.ts`
- `src/i18n/ru-RU/telegram.json`
- `src/i18n/en-US/telegram.json`
- `.env.development.example`
- `.env.production.example`
- `dev_docs/telegram-bot-menu-system.md`
