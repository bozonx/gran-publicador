Исправление ошибки сохранения настроек оптимизации изображений

**Проблема:**
При попытке сохранить настройки оптимизации изображений в проекте возникала ошибка "400 Bad Request", указывающая на то, что свойства `mediaOptimization`, `media_optimization` и `media_optimization_json` не должны существовать в объекте `preferences`.

**Причина:**
1.  DTO на бэкенде (`ProjectPreferencesDto`) не описывал поле `mediaOptimization`, а глобальная валидация запрещает передачу полей, не описанных в DTO (`forbidNonWhitelisted: true`).
2.  Фронтенд отправлял настройки оптимизации сразу в трех форматах (`mediaOptimization`, `media_optimization`, `media_optimization_json`), два из которых были избыточны и вызывали ошибку валидации.

**Решение:**
1.  **Бэкенд:** Обновлен файл `src/common/dto/json-objects.dto.ts`.
    -   Добавлен класс `MediaOptimizationDto` для валидации настроек оптимизации.
    -   В `ProjectPreferencesDto` добавлено поле `mediaOptimization` с типом `MediaOptimizationDto`.
2.  **Фронтенд:** Обновлен компонент `ui/app/components/forms/ProjectForm.vue`.
    -   Удалена отправка избыточных полей `media_optimization` и `media_optimization_json`. Теперь отправляется только стандартное camelCase поле `mediaOptimization`.

**Результат:**
Настройки оптимизации изображений теперь корректно проходят валидацию на бэкенде и сохраняются в базе данных.
