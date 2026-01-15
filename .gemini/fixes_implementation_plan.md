# План реализации исправлений

## 🔴 Критические исправления

### 1. NotificationsService - Исправление проверок на null

**Файл**: `src/modules/notifications/notifications.service.ts`

#### Изменения в методе `markAsRead`:

```typescript
// БЫЛО:
async markAsRead(id: string, userId: string) {
  const notification = await (this.prisma as any).notification.findUnique({
    where: { id },
  });

  if (notification?.userId !== userId) {
    throw new NotFoundException('Notification not found');
  }

  return (this.prisma as any).notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

// СТАЛО:
async markAsRead(id: string, userId: string) {
  const notification = await (this.prisma as any).notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new NotFoundException('Notification not found');
  }

  if (notification.userId !== userId) {
    throw new NotFoundException('Notification not found');
  }

  return (this.prisma as any).notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}
```

#### Добавить валидацию в метод `create`:

```typescript
async create(data: CreateNotificationDto) {
  // Валидация входных данных
  if (!data.userId || !data.type || !data.message) {
    throw new BadRequestException('Missing required notification fields');
  }

  const notification = await (this.prisma as any).notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      title: data.title,
      message: data.message,
      meta: (data.meta || {}) as any,
    },
  });

  // Обработка ошибок WebSocket
  try {
    this.gateway.sendToUser(data.userId, notification);
  } catch (error: any) {
    this.logger.error(`Failed to send notification via WebSocket: ${error.message}`);
    // Не бросаем ошибку, т.к. уведомление уже сохранено в БД
  }

  return notification;
}
```

---

### 2. ProjectsService - Безопасная работа с массивами

**Файл**: `src/modules/projects/projects.service.ts`

#### Исправление строки 222:

```typescript
// БЫЛО:
const userMember = project.members[0];
// ...
role: project.ownerId === userId ? 'owner' : userMember?.role?.toLowerCase(),

// СТАЛО:
const userMember = project.members.length > 0 ? project.members[0] : null;
// ...
role: project.ownerId === userId ? 'owner' : (userMember?.role?.toLowerCase() || 'viewer'),
```

#### Исправление строки 305:

```typescript
// БЫЛО:
role: project.ownerId === userId ? 'owner' : project.members[0]?.role?.toLowerCase(),

// СТАЛО:
const userMember = project.members.length > 0 ? project.members[0] : null;
role: project.ownerId === userId ? 'owner' : (userMember?.role?.toLowerCase() || 'viewer'),
```

#### Исправление строк 548-550 (обработка null для inviter):

```typescript
// БЫЛО:
const inviterName =
  inviter?.fullName ||
  (inviter?.telegramUsername ? `@${inviter.telegramUsername}` : 'Someone');

// СТАЛО:
const inviterName = inviter
  ? (inviter.fullName || (inviter.telegramUsername ? `@${inviter.telegramUsername}` : 'Unknown User'))
  : 'System';
```

---

### 3. PublicationsService - Проверки на null для content

**Файл**: `src/modules/publications/publications.service.ts`

#### Исправление строки 120:

```typescript
// БЫЛО:
message: `Publication "${fullPub.title || fullPub.content?.substring(0, 30)}..." has expired`,

// СТАЛО:
message: `Publication "${fullPub.title || (fullPub.content ? fullPub.content.substring(0, 30) : 'Untitled')}..." has expired`,
```

#### Исправление строки 311:

```typescript
// БЫЛО:
message: `Publication "${publication.title || publication.content?.substring(0, 30)}..." ${finalStatus === PublicationStatus.FAILED ? 'failed' : 'was only partially published'}.${detailMessage}`,

// СТАЛО:
const publicationName = publication.title || 
  (publication.content ? publication.content.substring(0, 30) : 'Untitled');
message: `Publication "${publicationName}..." ${finalStatus === PublicationStatus.FAILED ? 'failed' : 'was only partially published'}.${detailMessage}`,
```

#### Исправление строк 461-468 (безопасная работа с media):

```typescript
// БЫЛО:
const parsedMedia = publication.media?.map(pm => ({
  ...pm,
  media: pm.media
    ? {
        ...pm.media,
        meta: this.parseMetaJson(pm.media.meta),
      }
    : pm.media,
}));

// СТАЛО:
const parsedMedia = publication.media?.map(pm => {
  if (!pm.media) {
    this.logger.warn(`Publication ${publication.id} has media entry without media object`);
    return pm;
  }
  
  return {
    ...pm,
    media: {
      ...pm.media,
      meta: this.parseMetaJson(pm.media.meta),
    },
  };
});
```

---

### 4. AuthService - Валидация auth_date

**Файл**: `src/modules/auth/auth.service.ts`

#### Исправление строк 158-163:

```typescript
// БЫЛО:
const now = Math.floor(Date.now() / 1000);
if (now - data.auth_date > 86400) {
  this.logger.warn('Telegram widget data expired');
  return false;
}

// СТАЛО:
const now = Math.floor(Date.now() / 1000);

// Проверка на корректность auth_date
if (typeof data.auth_date !== 'number' || data.auth_date < 0) {
  this.logger.warn('Invalid auth_date value');
  return false;
}

// Проверка на данные из будущего
if (data.auth_date > now + 300) { // 5 минут допуска на разницу часов
  this.logger.warn('auth_date is in the future');
  return false;
}

// Проверка на истечение срока
if (now - data.auth_date > 86400) {
  this.logger.warn('Telegram widget data expired');
  return false;
}
```

#### Исправление строк 194-199:

```typescript
// БЫЛО:
const now = Math.floor(Date.now() / 1000);
if (now - Number(authDate) > 86400) {
  this.logger.warn('Telegram init data expired');
  return false;
}

// СТАЛО:
const now = Math.floor(Date.now() / 1000);
const authDateNum = Number(authDate);

// Проверка на корректность
if (isNaN(authDateNum) || authDateNum < 0) {
  this.logger.warn('Invalid auth_date value');
  return false;
}

// Проверка на данные из будущего
if (authDateNum > now + 300) {
  this.logger.warn('auth_date is in the future');
  return false;
}

// Проверка на истечение срока
if (now - authDateNum > 86400) {
  this.logger.warn('Telegram init data expired');
  return false;
}
```

---

## 🟡 Средние исправления

### 5. SocialPostingService - Улучшение типизации

**Файл**: `src/modules/social-posting/social-posting.service.ts`

#### Исправление строк 70-94:

```typescript
// БЫЛО:
const response = await this.sendRequest<PreviewResponseDto>('preview', request);

if (response.success && 'valid' in (response.data || {})) {
  const data = response.data as any;
  if (data.valid) {
    return {
      success: true,
      message: 'Connection and credentials are valid (Preview mode)',
      details: response.data,
    };
  } else {
    return {
      success: false,
      message: 'Platform rejected the preview request',
      details: (response.data as any)?.errors || response.data,
    };
  }
} else {
  return {
    success: false,
    message: 'Service returned error',
    details: response,
  };
}

// СТАЛО:
const response = await this.sendRequest<PreviewResponseDto>('preview', request);

// Проверка структуры ответа
if (!response || typeof response !== 'object') {
  return {
    success: false,
    message: 'Invalid response from service',
    details: response,
  };
}

if (response.success && response.data && typeof response.data === 'object') {
  const data = response.data as any;
  
  if ('valid' in data && data.valid === true) {
    return {
      success: true,
      message: 'Connection and credentials are valid (Preview mode)',
      details: response.data,
    };
  } else {
    return {
      success: false,
      message: 'Platform rejected the preview request',
      details: data.errors || response.data,
    };
  }
} else {
  return {
    success: false,
    message: response.error?.message || 'Service returned error',
    details: response,
  };
}
```

#### Исправление строк 502-524 (валидация publishedAt):

```typescript
// БЫЛО:
if (response.success && response.data) {
  const meta = post.meta || {};
  await this.prisma.post.update({
    where: { id: post.id },
    data: {
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(response.data.publishedAt),
      // ...
    },
  });
  return { success: true, url: response.data.url };
}

// СТАЛО:
if (response.success && response.data) {
  // Валидация publishedAt
  let publishedAt: Date;
  try {
    publishedAt = new Date(response.data.publishedAt);
    if (isNaN(publishedAt.getTime())) {
      throw new Error('Invalid date');
    }
  } catch (error) {
    this.logger.warn(`Invalid publishedAt from microservice, using current time`);
    publishedAt = new Date();
  }

  const meta = post.meta || {};
  await this.prisma.post.update({
    where: { id: post.id },
    data: {
      status: PostStatus.PUBLISHED,
      publishedAt,
      // ...
    },
  });
  return { success: true, url: response.data.url };
}
```

---

### 6. MediaService - Исправление race condition

**Файл**: `src/modules/media/media.service.ts`

#### Исправление строк 527-542:

```typescript
// БЫЛО:
const fileStream = fs.createWriteStream(filePath);
let size = 0;

await new Promise<void>((resolve, reject) => {
  stream.on('data', chunk => {
    size += chunk.length;
    if (size > this.maxFileSize) {
      fileStream.destroy();
      reject(new BadRequestException(`File exceeds size limit`));
    }
  });
  stream.pipe(fileStream);
  fileStream.on('finish', resolve);
  fileStream.on('error', reject);
});

// СТАЛО:
const fileStream = fs.createWriteStream(filePath);
let size = 0;
let sizeExceeded = false;

await new Promise<void>((resolve, reject) => {
  stream.on('data', chunk => {
    if (sizeExceeded) return;
    
    size += chunk.length;
    if (size > this.maxFileSize) {
      sizeExceeded = true;
      
      // Останавливаем оба стрима
      fileStream.destroy();
      stream.destroy();
      
      // Удаляем частично записанный файл
      unlink(filePath).catch(err => {
        this.logger.error(`Failed to delete oversized file: ${err.message}`);
      });
      
      reject(new BadRequestException(
        `File exceeds size limit of ${Math.round(this.maxFileSize / 1024 / 1024)}MB`
      ));
    }
  });
  
  stream.pipe(fileStream);
  
  fileStream.on('finish', () => {
    if (!sizeExceeded) {
      resolve();
    }
  });
  
  fileStream.on('error', reject);
  stream.on('error', reject);
});

// Дополнительная проверка после записи
if (sizeExceeded) {
  throw new BadRequestException('File size validation failed');
}
```

#### Исправление строки 710 (проверка contentLength):

```typescript
// БЫЛО:
if (contentLength && parseInt(contentLength) > this.maxFileSize) {
  throw new BadRequestException(`File too large (${contentLength} bytes)`);
}

// СТАЛО:
if (contentLength) {
  const size = parseInt(contentLength, 10);
  if (isNaN(size) || size < 0) {
    this.logger.warn(`Invalid content-length header: ${contentLength}`);
  } else if (size > this.maxFileSize) {
    throw new BadRequestException(
      `File too large (${size} bytes, max: ${this.maxFileSize})`
    );
  }
}
```

---

### 7. LlmService - Добавление retry логики

**Файл**: `src/modules/llm/llm.service.ts`

#### Добавить новый метод с retry:

```typescript
/**
 * Send request with retry logic.
 */
private async sendRequestWithRetry<T>(
  url: string,
  body: any,
  maxRetries: number = 3,
  timeoutMs: number = 60000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        // Не retry для клиентских ошибок (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`LLM Router returned ${response.status}: ${errorText}`);
        }
        
        // Retry для серверных ошибок (5xx)
        throw new Error(`Server error ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (error: any) {
      lastError = error;
      
      // Не retry для timeout или клиентских ошибок
      if (error.name === 'AbortError' || error.message.includes('returned 4')) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logger.warn(
          `LLM request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms: ${error.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
```

#### Обновить метод `generateContent`:

```typescript
async generateContent(dto: GenerateContentDto): Promise<LlmResponse> {
  const url = `${this.config.serviceUrl}/chat/completions`;
  
  // ... (подготовка requestBody)
  
  this.logger.debug(`Sending request to LLM Router: ${url}`);
  
  try {
    const data = await this.sendRequestWithRetry<LlmResponse>(
      url,
      requestBody,
      3, // maxRetries
      (this.config.timeoutSecs || 60) * 1000,
    );
    
    // Валидация ответа
    if (!data.choices || data.choices.length === 0) {
      throw new Error('LLM Router returned empty choices array');
    }
    
    this.logger.debug(`LLM Router response: ${JSON.stringify(data._router, null, 2)}`);
    return data;
  } catch (error: any) {
    this.logger.error(`Failed to generate content: ${error.message}`, error.stack);
    throw error;
  }
}
```

---

### 8. TranslateService - Аналогичные улучшения

**Файл**: `src/modules/translate/translate.service.ts`

#### Добавить валидацию длины текста:

```typescript
async translateText(dto: TranslateTextDto): Promise<TranslateResponseDto> {
  // Валидация входных данных
  if (!dto.text || dto.text.trim().length === 0) {
    throw new BadRequestException('Text is required for translation');
  }

  const maxLength = dto.maxTextLength || this.config.maxTextLength || 50000;
  if (dto.text.length > maxLength) {
    throw new BadRequestException(
      `Text exceeds maximum length of ${maxLength} characters`
    );
  }

  const url = `${this.config.serviceUrl}/translate`;
  
  // ... (остальной код)
}
```

#### Добавить retry логику (аналогично LlmService):

```typescript
private async sendRequestWithRetry<T>(
  url: string,
  body: any,
  timeoutMs: number,
): Promise<T> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Translate Gateway returned ${response.status}: ${errorText}`);
        }
        
        throw new Error(`Server error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as T;
      
      // Валидация ответа
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Translate Gateway');
      }
      
      return data;
    } catch (error: any) {
      lastError = error;
      
      if (error.name === 'AbortError' || error.message.includes('returned 4')) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logger.warn(
          `Translation request failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('All retry attempts failed');
}
```

---

## 📝 Чеклист для проверки после исправлений

- [ ] Все unit тесты проходят
- [ ] Добавлены новые тесты для edge cases
- [ ] Проверена работа с null/undefined значениями
- [ ] Проверена работа с пустыми массивами
- [ ] Проверена валидация дат и временных меток
- [ ] Проверена обработка сетевых ошибок
- [ ] Проверена работа с файлами большого размера
- [ ] Логирование работает корректно
- [ ] Нет регрессий в существующей функциональности

---

## 🚀 Порядок применения исправлений

1. **День 1**: Исправления 1-2 (NotificationsService, ProjectsService)
2. **День 2**: Исправления 3-4 (PublicationsService, AuthService)
3. **День 3**: Исправления 5-6 (SocialPostingService, MediaService)
4. **День 4**: Исправления 7-8 (LlmService, TranslateService)
5. **День 5**: Тестирование и проверка по чеклисту
