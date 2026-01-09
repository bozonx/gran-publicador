# Интеграция с bozonx-social-media-posting

Эта документация описывает, как Gran Publicador взаимодействует с библиотекой `bozonx-social-media-posting` для публикации контента в социальные сети.

## Обзор

Интеграция реализована в модуле `SocialPostingModule` через сервис `SocialPostingService`. Библиотека используется в "режиме библиотеки" (Library Mode), что позволяет избежать запуска отдельного микросервиса.

## Конфигурация

Клиент инициализируется в методе `onModuleInit`:

```typescript
this.postingClient = createPostingClient({
  accounts: {}, // Используем inline auth для каждого запроса
  logLevel: 'info',
  logger: new LibraryLogger(), // Кастомный адаптер логов
  retryAttempts: 3,
  retryDelayMs: 2000,
});
```

## Авторизация (Inline Auth)

Мы не храним аккаунты в конфигурации библиотеки. Вместо этого мы передаем учетные данные напрямую в каждом запросе (`auth` поле в `PostRequestDto`). Это позволяет динамически управлять каналами из базы данных Gran Publicador.

Для Telegram используются:
- `telegramBotToken` или `botToken`

## Обработка ошибок

Сервис использует структурированные ошибки из библиотеки:

```typescript
if (!response.success) {
  const platformError = response as ErrorResponseDto;
  // Сохранение кода ошибки, сообщения и деталей в поле meta поста
}
```

Все ошибки сохраняются в поле `meta` таблицы `Post` в формате JSON, что позволяет просматривать их в UI.

## Логирование

Используется `LibraryLogger`, который транслирует логи библиотеки в стандартный `Logger` NestJS. Все операции логируются с префиксом `[SocialMediaPostingLib]`.

Детальные логи публикации доступны в `SocialPostingService` с указанием контекста (ID поста, ID канала).

## Тестирование (Dry Run)

### Юнит-тестирование сервиса

Для тестирования `SocialPostingService` без отправки реальных запросов, используйте мок:

```typescript
const mockPostingClient = {
  post: jest.fn().mockResolvedValue({ success: true, data: { ... } }),
  preview: jest.fn().mockResolvedValue({ success: true, data: { ... } }),
  destroy: jest.fn(),
};

service['postingClient'] = mockPostingClient;
```

### API Тестирование связи

В системе реализован эндпоинт для проверки корректности настроек канала без публикации реального поста:

**POST** `/api/v1/channels/:id/test`

Этот эндпоинт вызывает метод `preview()` библиотеки, который:
1. Проверяет валидность Credentials (токены, ключи).
2. Проверяет доступность канала.
3. Проверяет формат сообщения.
4. **Не публикует** сообщение на платформе.

Это идеальный способ добавить в UI кнопку "Проверить соединение".

## Поддерживаемые типы медиа

1. **IMAGE** -> `cover` (одиночный) или `media` (альбом)
2. **VIDEO** -> `video`
3. **AUDIO** -> `audio`
4. **DOCUMENT** -> `document`

Локальные файлы (`StorageType.LOCAL`) должны быть доступны по публичному URL для корректной работы большинства соцсетей.
