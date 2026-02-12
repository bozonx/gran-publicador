---
description: Применение миграций базы данных на Render.com
---

# Применение миграций на Render.com

Этот workflow описывает процесс безопасного применения миграций Prisma на Render.com.

## Метод 1: Render Job (Рекомендуется)

### Первоначальная настройка

1. Откройте Render Dashboard и перейдите в ваш проект
2. Нажмите **"New"** → **"Job"**
3. Настройте Job:
   - **Name:** `gran-publicador-migrations`
   - **Runtime:** `Node`
   - **Build Command:** `pnpm install --frozen-lockfile && pnpm prisma generate`
   - **Start Command:** `pnpm db:migrate:deploy`
4. Добавьте переменные окружения:
   - `DATABASE_URL` — скопируйте из вашего основного web service
5. Сохраните Job

### Применение миграций

1. Перейдите в созданный Job
2. Нажмите **"Manual Deploy"** или **"Run Job"**
3. Дождитесь завершения и проверьте логи
4. После успешного выполнения можно деплоить основное приложение

## Метод 2: Render Blueprint

### Первоначальная настройка

1. Убедитесь, что файл `render.yaml` находится в корне репозитория
2. В Render Dashboard нажмите **"New"** → **"Blueprint"**
3. Подключите ваш GitHub/GitLab репозиторий
4. Render автоматически создаст:
   - Web service для backend
   - Job для миграций
   - Database (если указана)
5. Настройте переменные окружения в созданных сервисах

### Применение миграций

1. Перейдите в Job `gran-publicador-migrations`
2. Нажмите **"Run Job"**
3. Проверьте логи выполнения

## Метод 3: Manual Shell (для разовых случаев)

1. Откройте ваш web service в Render Dashboard
2. Перейдите на вкладку **"Shell"**
3. Выполните команду:
   ```bash
   pnpm db:migrate:deploy
   ```
4. Дождитесь завершения

⚠️ **Внимание:** Этот метод не рекомендуется для production, так как может вызвать проблемы при автомасштабировании.

## Workflow деплоя с миграциями

### Стандартный процесс

1. **Создайте миграцию локально:**
   ```bash
   pnpm db:dev:migrate
   ```

2. **Закоммитьте изменения:**
   ```bash
   git add prisma/migrations
   git commit -m "feat: add new migration"
   git push origin main
   ```

3. **Примените миграцию на Render.com:**
   - Запустите Migration Job (Метод 1 или 2)
   - Дождитесь успешного завершения

4. **Деплой приложения:**
   - GitHub Actions автоматически соберет и опубликует Docker image
   - Render автоматически подхватит новый image и перезапустит сервис

### Rollback миграции

Если миграция вызвала проблемы:

1. **Откатите код:**
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Откатите миграцию в БД** (если необходимо):
   - Используйте Shell в Render Dashboard
   - Выполните ручной откат через SQL или Prisma

3. **Проверьте состояние:**
   ```bash
   pnpm prisma migrate status
   ```

## Проверка статуса миграций

Через Shell в Render Dashboard:

```bash
# Проверить статус миграций
pnpm prisma migrate status

# Посмотреть историю миграций
pnpm prisma migrate resolve --help
```

## Troubleshooting

### Ошибка: "Migration failed"

1. Проверьте логи Job
2. Убедитесь, что `DATABASE_URL` корректен
3. Проверьте, что миграция не конфликтует с существующими данными

### Ошибка: "Database is locked"

- Подождите завершения других операций с БД
- Убедитесь, что миграция не запущена параллельно в нескольких местах

### Ошибка: "Prisma schema is out of sync"

```bash
# Сгенерируйте Prisma Client заново
pnpm prisma generate
```

## Best Practices

✅ **DO:**
- Всегда используйте отдельный Job для миграций
- Проверяйте миграции локально перед деплоем
- Делайте бэкап БД перед критическими миграциями
- Проверяйте логи после применения миграций

❌ **DON'T:**
- Не запускайте миграции в Start Command при автомасштабировании
- Не применяйте миграции напрямую в production БД без тестирования
- Не игнорируйте ошибки миграций
