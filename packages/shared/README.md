# @gran/shared

Общие константы, контракты и вспомогательная логика для проекта Gran Publicador.

## Структура

- `src/social-posting` — логика форматирования и подготовки контента для социальных сетей.
- `src/utils` — общие утилиты (теги, деревья библиотек и др.).
- `src/*.constants.ts` — константы и конфигурации платформ.
- `src/*.contracts.ts` — общие интерфейсы и контракты.

## Тестирование

Для запуска тестов используйте команду:

```bash
pnpm test
```

Или в корневой директории пакета:

```bash
npm test
```

### Основные покрытые модули:

1. **BodyFormatter** (`social-posting/body-formatter.ts`) — сборка тела поста из блоков шаблона.
2. **MdToTelegramHtml** (`social-posting/md-to-telegram-html.ts`) — конвертация Markdown в HTML для Telegram.
3. **TagsFormatter** (`social-posting/tags-formatter.ts`) — продвинутое форматирование тегов (смена регистра).
4. **Tags Utils** (`utils/tags.ts`) — парсинг и нормализация тегов.
5. **ContentLibraryTree** (`utils/content-library-tree.ts`) — расчет вложенных счетчиков для библиотеки контента.
6. **SocialMediaPlatforms** (`social-media-platforms.constants.ts`) — хелперы для получения конфигураций платформ.
