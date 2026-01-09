# Graceful Shutdown

## Обзор

Gran Publicador реализует graceful shutdown для обеспечения корректного завершения работы приложения при получении сигналов остановки (SIGTERM, SIGINT).

## Последовательность shutdown

### 1. Получение сигнала
- **SIGTERM** - от Docker, Kubernetes, systemd
- **SIGINT** - Ctrl+C в терминале

### 2. Прекращение приема новых запросов
- Fastify перестает принимать новые соединения
- Существующие соединения продолжают обрабатываться

### 3. Lifecycle hooks (OnModuleDestroy)
NestJS вызывает хуки в обратном порядке регистрации модулей:

1. **SocialPostingService**
   - Вызов `postingClient.destroy()`
   - Закрытие активных соединений с платформами

2. **PrismaService**
   - Вызов `$disconnect()`
   - Закрытие соединения с SQLite

3. **ShutdownService**
   - Координация процесса shutdown
   - Контроль таймаута

### 4. Завершение приложения
- Exit code 0 при успешном shutdown
- Exit code 1 при ошибках

## Конфигурация

### Таймаут shutdown

По умолчанию установлен таймаут **30 секунд**. Если graceful shutdown не завершится за это время, приложение будет принудительно остановлено.

```env
# В .env файле
SHUTDOWN_TIMEOUT_MS=30000
```

## Логирование

Все этапы shutdown логируются с соответствующими метками:

```
[Bootstrap] Received SIGTERM, starting graceful shutdown...
[SocialPostingService] Cleaning up social posting client...
[SocialPostingService] ✅ Social posting client destroyed
[PrismaService] Closing database connection...
[PrismaService] ✅ Database connection closed
[ShutdownService] ✅ Graceful shutdown completed successfully
[Bootstrap] ✅ Application closed successfully
```

### Индикаторы статуса
- ✅ - успешное завершение операции
- ❌ - ошибка при выполнении операции

## Обработка ошибок

### Ошибки в lifecycle hooks
- Логируются с уровнем ERROR
- Не блокируют shutdown других сервисов (кроме PrismaService)
- Приложение завершается с exit code 1

### Превышение таймаута
- Логируется ошибка "Shutdown timeout exceeded"
- Приложение принудительно завершается
- Exit code 1

## Тестирование

### Локальное тестирование

```bash
# Запустить приложение
pnpm start:dev

# В другом терминале отправить SIGTERM
kill -TERM $(pgrep -f "nest start")

# Или SIGINT (Ctrl+C в терминале с приложением)
```

### Docker

```bash
# Docker отправляет SIGTERM и ждет 10 секунд по умолчанию
docker stop <container_id>

# Увеличить таймаут Docker (если нужно)
docker stop -t 30 <container_id>
```

### Kubernetes

Настройка таймаута в pod spec:

```yaml
spec:
  terminationGracePeriodSeconds: 30
```

## Best Practices

1. **Всегда используйте graceful shutdown в продакшн**
   - Не используйте `kill -9` (SIGKILL)
   - Дайте приложению время на корректное завершение

2. **Настройте таймауты правильно**
   - Учитывайте время обработки самых долгих запросов
   - Добавьте запас для cleanup операций
   - Убедитесь, что `SHUTDOWN_TIMEOUT_MS` меньше таймаута Docker/Kubernetes

3. **Мониторьте логи**
   - Проверяйте успешность shutdown в логах
   - Отслеживайте ошибки при завершении
   - Обращайте внимание на превышения таймаута

4. **Тестируйте регулярно**
   - Проверяйте shutdown в процессе разработки
   - Симулируйте различные сценарии (с активными запросами, без них)

## Архитектура

### ShutdownService

Централизованный сервис для координации graceful shutdown:

- Реализует `OnApplicationShutdown` hook
- Защита от повторных вызовов
- Контроль таймаута
- Детальное логирование

### Signal Handlers

Явная обработка сигналов в `main.ts`:

- SIGTERM handler
- SIGINT handler
- uncaughtException handler
- unhandledRejection handler

### Service Cleanup

Каждый сервис с ресурсами реализует `OnModuleDestroy`:

- **PrismaService** - закрытие БД соединения
- **SocialPostingService** - очистка posting client
- Другие сервисы при необходимости

## Troubleshooting

### Приложение не завершается

**Возможные причины:**
- Активные таймеры или интервалы
- Незакрытые соединения
- Зависшие промисы

**Решение:**
- Проверьте логи на наличие ошибок
- Убедитесь, что все ресурсы корректно очищаются
- Уменьшите `SHUTDOWN_TIMEOUT_MS` для быстрого обнаружения проблем

### Превышение таймаута

**Возможные причины:**
- Слишком короткий таймаут
- Медленное закрытие соединений
- Долгие операции cleanup

**Решение:**
- Увеличьте `SHUTDOWN_TIMEOUT_MS`
- Оптимизируйте операции cleanup
- Проверьте логи для определения медленных операций

### Ошибки при shutdown

**Возможные причины:**
- Проблемы с БД соединением
- Ошибки в posting client
- Некорректная очистка ресурсов

**Решение:**
- Проверьте детальные логи ошибок
- Убедитесь в корректности cleanup логики
- Добавьте дополнительное логирование при необходимости
