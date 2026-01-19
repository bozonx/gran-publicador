# Параметры оптимизации для Media Storage

## Обзор

Все параметры оптимизации изображений и миниатюр берутся из переменных окружения и правильно передаются в Media Storage микросервис согласно актуальной спецификации.

## Переменные окружения

### Параметры компрессии изображений

Эти параметры применяются при загрузке файлов (`POST /files` и `POST /files/from-url`):

```bash
# Формат по умолчанию (webp или avif)
IMAGE_COMPRESSION_FORMAT=webp

# Максимальный размер стороны изображения (в пикселях)
IMAGE_COMPRESSION_MAX_DIMENSION=3840

# Удалять ли метаданные (EXIF/ICC/XMP) при сжатии
IMAGE_COMPRESSION_STRIP_METADATA=false

# Использовать ли сжатие без потерь (lossless)
IMAGE_COMPRESSION_LOSSLESS=false

# Общее качество для WebP и AVIF (1-100, по умолчанию 80)
IMAGE_COMPRESSION_QUALITY=80

# AVIF chroma subsampling (например, 4:2:0 или 4:4:4)
IMAGE_COMPRESSION_AVIF_CHROMA_SUBSAMPLING=4:2:0
```

### Параметры миниатюр

Эти параметры применяются при запросе миниатюр (`GET /files/:id/thumbnail`):

```bash
# Максимальный размер стороны миниатюры (в пикселях)
THUMBNAIL_MAX_DIMENSION=2048

# Качество миниатюры (1-100, по умолчанию 80)
THUMBNAIL_QUALITY=80
```

## Как параметры передаются

### 1. Загрузка файла (POST /media/upload)

При загрузке файла через `multipart/form-data`, параметры компрессии передаются как **JSON строка** в поле `optimize`:

```typescript
formData.append('file', blob, filename);
formData.append('optimize', JSON.stringify({
  format: 'webp',
  maxDimension: 3840,
  quality: 80,
  flatten: '#ffffff',
  autoOrient: true
}));
```

### 2. Загрузка по URL (POST /media/upload-from-url)

В Media Storage Microservice, параметры компрессии передаются в объекте `optimize` внутри JSON body:

```json
{
  "url": "https://example.com/image.jpg",
  "filename": "image.jpg",
  "optimize": {
    "format": "webp",
    "maxDimension": 3840,
    "quality": 80
  }
}
```

### 3. Получение миниатюры (GET /media/:id/thumbnail)

При запросе миниатюры, качество передается как **query параметр**:

```
GET /media/:id/thumbnail?w=400&h=400&quality=80
```

## Конфигурация

Параметры читаются в `src/config/media.config.ts`. Метод `getImageCompressionOptions` возвращает объект со всеми активными настройками.
